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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, role, invitedBy, appUrl }: InvitationRequest = await req.json();

    console.log("Processing invitation for:", email, "with role:", role, "appUrl:", appUrl);

    // Generate unique token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", invitedBy)
      .single();

    if (!existingProfile) {
      throw new Error("Inviter profile not found");
    }

    // Store invitation token
    const { data: invitation, error: invitationError } = await supabase
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

    // Create invitation link
    const invitationLink = `${appUrl}/auth/accept-invite?token=${token}`;
    
    console.log("Generated invitation link:", invitationLink);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "CorpPassSecure <onboarding@resend.dev>",
      to: [email],
      subject: "Invitation to join CorpPassSecure",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">You've been invited to CorpPassSecure</h1>
          <p>You have been invited to join CorpPassSecure as a <strong>${role}</strong>.</p>
          <p>Click the button below to accept your invitation and create your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't expect this invitation, you can safely ignore this email.
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
        error: error.message,
        details: error.toString() 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
