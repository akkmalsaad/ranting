// Hand-written to match supabase/migrations/20260928120000_club_tenancy.sql in the
// shape `supabase gen types typescript` produces. Regenerate with the Supabase CLI
// once a Ranting project is designated, and replace this file with the output.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      clubs: {
        Row: { id: string; name: string; discipline: string; created_by: string | null } & Timestamps;
        Insert: { id?: string; name: string; discipline: string; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; discipline?: string };
        Relationships: [];
      };
      club_members: {
        Row: { id: string; club_id: string; user_id: string; role: Database["public"]["Enums"]["club_role"]; created_at: string };
        Insert: { id?: string; club_id: string; user_id: string; role: Database["public"]["Enums"]["club_role"]; created_at?: string };
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "club_members_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      branches: {
        Row: { id: string; club_id: string; name: string; address: string; archived_at: string | null; created_by: string | null } & Timestamps;
        Insert: { id?: string; club_id: string; name: string; address?: string; archived_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; address?: string; archived_at?: string | null };
        Relationships: [
          { foreignKeyName: "branches_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      students: {
        Row: {
          id: string;
          club_id: string;
          branch_id: string | null;
          full_name: string;
          date_of_birth: string | null;
          gender: StudentGender | null;
          phone: string | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          status: StudentStatus;
          join_date: string;
          notes: string | null;
          archived_at: string | null;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          club_id: string;
          branch_id?: string | null;
          full_name: string;
          date_of_birth?: string | null;
          gender?: StudentGender | null;
          phone?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          status?: StudentStatus;
          join_date?: string;
          notes?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          full_name?: string;
          date_of_birth?: string | null;
          gender?: StudentGender | null;
          phone?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          status?: StudentStatus;
          join_date?: string;
          notes?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "students_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "students_club_id_branch_id_fkey"; columns: ["club_id", "branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["club_id", "id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_club: { Args: { p_name: string; p_discipline: string }; Returns: string };
    };
    Enums: { club_role: "owner" };
    CompositeTypes: Record<string, never>;
  };
};

export type StudentStatus = "active" | "inactive";
export type StudentGender = "male" | "female";
export type ClubRole = Database["public"]["Enums"]["club_role"];
