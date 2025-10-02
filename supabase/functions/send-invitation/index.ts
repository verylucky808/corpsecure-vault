import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: "admin" | "moderator" | "user";
  invitedBy: string;
  appUrl: string;
  isResend?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify JWT token
    const jwtToken = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwtToken);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify admin role using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'администратор'
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin privileges required" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, role, invitedBy, appUrl, isResend }: InvitationRequest = await req.json();

    console.log("Processing invitation for:", email, "with role:", role, "appUrl:", appUrl, "isResend:", isResend);

    let token: string;
    let invitation: any;

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", invitedBy)
      .single();

    if (!existingProfile) {
      throw new Error("Inviter profile not found");
    }

    if (isResend) {
      // Find existing pending invitation and update it
      const { data: existingInvitation } = await supabase
        .from("invitation_tokens")
        .select("*")
        .eq("email", email)
        .eq("status", "pending")
        .single();

      if (existingInvitation) {
        // Generate new token and extend expiry
        token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const { data: updated, error: updateError } = await supabase
          .from("invitation_tokens")
          .update({
            token,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
          })
          .eq("id", existingInvitation.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating invitation:", updateError);
          throw updateError;
        }
        invitation = updated;
      } else {
        throw new Error("No pending invitation found for this email");
      }
    } else {
      // Create new invitation
      token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: newInvitation, error: invitationError } = await supabase
        .from("invitation_tokens")
        .insert({
          email,
          token,
          expires_at: expiresAt.toISOString(),
          invited_by: invitedBy,
          status: "pending",
        })
        .select()
        .single();

      if (invitationError) {
        console.error("Error creating invitation:", invitationError);
        throw invitationError;
      }
      invitation = newInvitation;
    }

    // Create invitation link
    const invitationLink = `${appUrl}/auth/accept-invite?token=${token}`;
    
    console.log("Generated invitation link:", invitationLink);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "CorpPassSecure <onboarding@resend.dev>",
      to: [email],
      subject: "Приглашение в CorpPassSecure",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Вы приглашены в CorpPassSecure</h1>
          <p>Вы были приглашены присоединиться к CorpPassSecure в роли <strong>${role}</strong>.</p>
          <p>Нажмите на кнопку ниже, чтобы принять приглашение и создать свой аккаунт:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Принять приглашение
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Это приглашение действительно в течение 7 дней.
          </p>
          <p style="color: #666; font-size: 14px;">
            Если вы не ожидали это приглашение, можете спокойно проигнорировать это письмо.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        invitation,
        emailResponse,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to send invitation. Please try again."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
