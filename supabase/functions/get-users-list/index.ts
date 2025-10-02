import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

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

    // Load profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, role, department, created_at")
      .neq("role", "deleted")
      .order("created_at", { ascending: false });

    if (profilesError) {
      throw profilesError;
    }

    // Load user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      throw rolesError;
    }

    // Get auth users to fetch emails (using service role)
    const { data: authData, error: listUsersError } = await supabase.auth.admin
      .listUsers();

    if (listUsersError) {
      console.error("Error loading auth users:", listUsersError);
    }

    const authUsers = authData?.users || [];

    // Combine data
    const users = (profiles || []).map((profile) => {
      const authUser = authUsers.find((u) => u.id === profile.user_id);
      const roles = (userRoles || [])
        .filter((ur) => ur.user_id === profile.user_id)
        .map((ur) => ur.role);

      return {
        ...profile,
        email: authUser?.email || "Unknown",
        roles: roles.length > 0 ? roles : ["user"],
      };
    });

    return new Response(
      JSON.stringify({ users }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in get-users-list function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
