export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          id: string
          user_id: string
          platform: string
          account_name: string
          customer_id: string
          refresh_token: string | null
          token_expires_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform?: string
          account_name: string
          customer_id: string
          refresh_token?: string | null
          token_expires_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          account_name?: string
          customer_id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      daily_metrics: {
        Row: {
          id: string
          account_id: string
          date: string
          campaign_id: string
          campaign_name: string
          metrics: Json
          device_data: Json | null
          top_keywords: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          date: string
          campaign_id: string
          campaign_name: string
          metrics: Json
          device_data?: Json | null
          top_keywords?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          date?: string
          campaign_id?: string
          campaign_name?: string
          metrics?: Json
          device_data?: Json | null
          top_keywords?: Json | null
          created_at?: string
        }
      }
      anomalies: {
        Row: {
          id: string
          account_id: string
          date: string
          metric: string
          expected_value: number
          actual_value: number
          percent_change: number
          severity: 'WARNING' | 'CRITICAL'
          ai_explanation: string | null
          context_data: Json | null
          resolved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          date: string
          metric: string
          expected_value: number
          actual_value: number
          percent_change: number
          severity: 'WARNING' | 'CRITICAL'
          ai_explanation?: string | null
          context_data?: Json | null
          resolved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          date?: string
          metric?: string
          expected_value?: number
          actual_value?: number
          percent_change?: number
          severity?: 'WARNING' | 'CRITICAL'
          ai_explanation?: string | null
          context_data?: Json | null
          resolved?: boolean
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          account_id: string
          date_range_start: string
          date_range_end: string
          report_type: string
          file_url: string | null
          generated_by: string
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          date_range_start: string
          date_range_end: string
          report_type?: string
          file_url?: string | null
          generated_by: string
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          date_range_start?: string
          date_range_end?: string
          report_type?: string
          file_url?: string | null
          generated_by?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
