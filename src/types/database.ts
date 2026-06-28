export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          full_name: string | null;
          avatar_url: string | null;
          education_stage: string | null;
          education_country: string | null;
          year_of_study: string | null;
          qualification_type: string | null;
          subjects: Json;
          subject_area: string | null;
          course_name: string | null;
          institution_name: string | null;
          institution_country: string | null;
          onboarding_completed: boolean;
          onboarding_completed_at: string | null;
          onboarding_step: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          education_stage?: string | null;
          education_country?: string | null;
          year_of_study?: string | null;
          qualification_type?: string | null;
          subjects?: Json;
          subject_area?: string | null;
          course_name?: string | null;
          institution_name?: string | null;
          institution_country?: string | null;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          education_stage?: string | null;
          education_country?: string | null;
          year_of_study?: string | null;
          qualification_type?: string | null;
          subjects?: Json;
          subject_area?: string | null;
          course_name?: string | null;
          institution_name?: string | null;
          institution_country?: string | null;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          school: string | null;
          student_type: string | null;
          study_focus: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          school?: string | null;
          student_type?: string | null;
          study_focus?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          school?: string | null;
          student_type?: string | null;
          study_focus?: string | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      study_rooms: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          subject: string | null;
          source_material: string | null;
          clarity_score: number | null;
          selected_concept: string | null;
          latest_clarity_score: number | null;
          status: string;
          weak_spots_count: number;
          created_at: string;
          updated_at: string;
          last_studied_at: string | null;
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          subject?: string | null;
          source_material?: string | null;
          clarity_score?: number | null;
          selected_concept?: string | null;
          latest_clarity_score?: number | null;
          status?: string;
          weak_spots_count?: number;
          created_at?: string;
          updated_at?: string;
          last_studied_at?: string | null;
          last_activity_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          subject?: string | null;
          source_material?: string | null;
          clarity_score?: number | null;
          selected_concept?: string | null;
          latest_clarity_score?: number | null;
          status?: string;
          weak_spots_count?: number;
          created_at?: string;
          updated_at?: string;
          last_studied_at?: string | null;
          last_activity_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_rooms_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          source_type: string;
          title: string | null;
          content: string;
          metadata: Json;
          original_file_name: string | null;
          storage_path: string | null;
          page_count: number | null;
          extracted_text_length: number | null;
          extraction_status: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          source_type?: string;
          title?: string | null;
          content: string;
          metadata?: Json;
          original_file_name?: string | null;
          storage_path?: string | null;
          page_count?: number | null;
          extracted_text_length?: number | null;
          extraction_status?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          source_type?: string;
          title?: string | null;
          content?: string;
          metadata?: Json;
          original_file_name?: string | null;
          storage_path?: string | null;
          page_count?: number | null;
          extracted_text_length?: number | null;
          extraction_status?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sources_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "study_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sources_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_room_sessions: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          state: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          state?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          state?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_room_sessions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "study_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_room_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      study_units: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          title: string;
          description: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_units_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "study_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_units_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      room_concepts: {
        Row: {
          id: string;
          room_id: string;
          unit_id: string | null;
          user_id: string;
          title: string;
          description: string | null;
          sort_order: number;
          status: "not_started" | "in_progress" | "gap_found" | "improving" | "clear";
          latest_clarity_score: number | null;
          best_clarity_score: number | null;
          latest_review_score: number | null;
          main_gap: string | null;
          prerequisite_concept_ids: string[];
          started_at: string | null;
          completed_at: string | null;
          last_reviewed_at: string | null;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          unit_id?: string | null;
          user_id: string;
          title: string;
          description?: string | null;
          sort_order?: number;
          status?: "not_started" | "in_progress" | "gap_found" | "improving" | "clear";
          latest_clarity_score?: number | null;
          best_clarity_score?: number | null;
          latest_review_score?: number | null;
          main_gap?: string | null;
          prerequisite_concept_ids?: string[];
          started_at?: string | null;
          completed_at?: string | null;
          last_reviewed_at?: string | null;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          unit_id?: string | null;
          user_id?: string;
          title?: string;
          description?: string | null;
          sort_order?: number;
          status?: "not_started" | "in_progress" | "gap_found" | "improving" | "clear";
          latest_clarity_score?: number | null;
          best_clarity_score?: number | null;
          latest_review_score?: number | null;
          main_gap?: string | null;
          prerequisite_concept_ids?: string[];
          started_at?: string | null;
          completed_at?: string | null;
          last_reviewed_at?: string | null;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_concepts_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "study_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_concepts_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "study_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_concepts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
