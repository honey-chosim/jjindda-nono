export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type DatingRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'cancelled_unpaid'

export type PaymentStatus =
  | 'pending'
  | 'pending_confirmation'
  | 'paid'
  | 'expired'

export type ReferralPayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export type SmsStatus = 'sent' | 'failed' | 'skipped_night' | 'skipped_duplicate'

export interface Database {
  public: {
    Tables: {
      invite_codes: {
        Row: {
          id: string
          code: string
          created_by: string | null
          used_by: string | null
          used_at: string | null
          is_active: boolean
          created_at: string
          label: string | null
        }
        Insert: {
          id?: string
          code: string
          created_by?: string | null
          used_by?: string | null
          used_at?: string | null
          is_active?: boolean
          created_at?: string
          label?: string | null
        }
        Update: {
          id?: string
          code?: string
          created_by?: string | null
          used_by?: string | null
          used_at?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          real_name: string | null
          phone: string | null
          gender: 'male' | 'female'
          birth_year: number
          birth_month: number
          birth_day: number
          height: number | null
          education: string | null
          school: string | null
          company: string | null
          job_title: string | null
          residence_city: string | null
          residence_district: string | null
          smoking: '비흡연' | '흡연' | '금연 중' | null
          drinking: '안 마심' | '사회적 음주' | '즐겨 마심' | null
          mbti: string | null
          hobbies: string[]
          pet: '없음' | '강아지' | '고양이' | '기타' | null
          bio: string | null
          photos: string[]
          preferred_age_min: number | null
          preferred_age_max: number | null
          preferred_height_min: number | null
          preferred_residence: string[]
          preferred_free_text: string | null
          is_active: boolean
          onboarding_completed: boolean
          is_verified: boolean
          verified_by_referrer: boolean
          rejection_reason: string | null
          marketing_sms: boolean
          last_active_at: string | null
          bank_name: string | null
          bank_account: string | null
          account_holder: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          real_name?: string | null
          phone?: string | null
          gender: 'male' | 'female'
          birth_year: number
          birth_month: number
          birth_day: number
          height?: number | null
          education?: string | null
          school?: string | null
          company?: string | null
          job_title?: string | null
          residence_city?: string | null
          residence_district?: string | null
          smoking?: '비흡연' | '흡연' | '금연 중' | null
          drinking?: '안 마심' | '사회적 음주' | '즐겨 마심' | null
          mbti?: string | null
          hobbies?: string[]
          pet?: '없음' | '강아지' | '고양이' | '기타' | null
          bio?: string | null
          photos?: string[]
          preferred_age_min?: number | null
          preferred_age_max?: number | null
          preferred_height_min?: number | null
          preferred_residence?: string[]
          preferred_free_text?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          is_verified?: boolean
          verified_by_referrer?: boolean
          rejection_reason?: string | null
          marketing_sms?: boolean
          last_active_at?: string | null
          bank_name?: string | null
          bank_account?: string | null
          account_holder?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          real_name?: string | null
          phone?: string | null
          gender?: 'male' | 'female'
          birth_year?: number
          birth_month?: number
          birth_day?: number
          height?: number | null
          education?: string | null
          school?: string | null
          company?: string | null
          job_title?: string | null
          residence_city?: string | null
          residence_district?: string | null
          smoking?: '비흡연' | '흡연' | '금연 중' | null
          drinking?: '안 마심' | '사회적 음주' | '즐겨 마심' | null
          mbti?: string | null
          hobbies?: string[]
          pet?: '없음' | '강아지' | '고양이' | '기타' | null
          bio?: string | null
          photos?: string[]
          preferred_age_min?: number | null
          preferred_age_max?: number | null
          preferred_height_min?: number | null
          preferred_residence?: string[]
          preferred_free_text?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          is_verified?: boolean
          verified_by_referrer?: boolean
          rejection_reason?: string | null
          marketing_sms?: boolean
          last_active_at?: string | null
          bank_name?: string | null
          bank_account?: string | null
          account_holder?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dating_requests: {
        Row: {
          id: string
          requester_id: string
          target_id: string
          status: DatingRequestStatus
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          target_id: string
          status?: DatingRequestStatus
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          target_id?: string
          status?: DatingRequestStatus
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          request_id: string
          user1_id: string
          user2_id: string
          payer_id: string
          payment_status: PaymentStatus
          payment_expires_at: string | null
          payment_confirmed_at: string | null
          paid_at: string | null
          kakao_room_url: string | null
          kakao_group_created: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          user1_id: string
          user2_id: string
          payer_id: string
          payment_status?: PaymentStatus
          payment_expires_at?: string | null
          payment_confirmed_at?: string | null
          paid_at?: string | null
          kakao_room_url?: string | null
          kakao_group_created?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          user1_id?: string
          user2_id?: string
          payer_id?: string
          payment_status?: PaymentStatus
          payment_expires_at?: string | null
          payment_confirmed_at?: string | null
          paid_at?: string | null
          kakao_room_url?: string | null
          kakao_group_created?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      daily_request_limits: {
        Row: {
          id: string
          user_id: string
          request_date: string
        }
        Insert: {
          id?: string
          user_id: string
          request_date?: string
        }
        Update: {
          id?: string
          user_id?: string
          request_date?: string
        }
      }
      request_quotas: {
        Row: {
          user_id: string
          quota_date: string
          sent_count: number
          received_count: number
          bonus_used: number
          created_at: string
        }
        Insert: {
          user_id: string
          quota_date: string
          sent_count?: number
          received_count?: number
          bonus_used?: number
          created_at?: string
        }
        Update: {
          user_id?: string
          quota_date?: string
          sent_count?: number
          received_count?: number
          bonus_used?: number
          created_at?: string
        }
      }
      sms_notifications: {
        Row: {
          id: string
          user_id: string
          template_key: string
          reference_id: string | null
          phone: string
          message: string
          sent_at: string
          solapi_message_id: string | null
          status: SmsStatus
          error: string | null
        }
        Insert: {
          id?: string
          user_id: string
          template_key: string
          reference_id?: string | null
          phone: string
          message: string
          sent_at?: string
          solapi_message_id?: string | null
          status?: SmsStatus
          error?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          template_key?: string
          reference_id?: string | null
          phone?: string
          message?: string
          sent_at?: string
          solapi_message_id?: string | null
          status?: SmsStatus
          error?: string | null
        }
      }
      referral_payouts: {
        Row: {
          id: string
          user_id: string
          amount_requested: number
          bank_name: string
          bank_account: string
          account_holder: string
          status: ReferralPayoutStatus
          requested_at: string
          processed_at: string | null
          admin_note: string | null
        }
        Insert: {
          id?: string
          user_id: string
          amount_requested: number
          bank_name: string
          bank_account: string
          account_holder: string
          status?: ReferralPayoutStatus
          requested_at?: string
          processed_at?: string | null
          admin_note?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          amount_requested?: number
          bank_name?: string
          bank_account?: string
          account_holder?: string
          status?: ReferralPayoutStatus
          requested_at?: string
          processed_at?: string | null
          admin_note?: string | null
        }
      }
      referral_earnings: {
        Row: {
          id: string
          referrer_id: string
          invitee_id: string
          invitee_gender: 'male' | 'female'
          amount: number
          earned_at: string
          paid_payout_id: string | null
        }
        Insert: {
          id?: string
          referrer_id: string
          invitee_id: string
          invitee_gender: 'male' | 'female'
          amount: number
          earned_at?: string
          paid_payout_id?: string | null
        }
        Update: {
          id?: string
          referrer_id?: string
          invitee_id?: string
          invitee_gender?: 'male' | 'female'
          amount?: number
          earned_at?: string
          paid_payout_id?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      send_dating_request: {
        Args: { p_requester_id: string; p_target_id: string }
        Returns: string
      }
      accept_dating_request: {
        Args: { p_request_id: string }
        Returns: string
      }
      cancel_dating_request: {
        Args: { p_request_id: string }
        Returns: void
      }
      instant_accept_match: {
        Args: { p_request_id: string }
        Returns: string
      }
      confirm_payment_transfer: {
        Args: { p_match_id: string }
        Returns: void
      }
      verify_referral_profile: {
        Args: { p_invitee_id: string; p_approved: boolean; p_note?: string }
        Returns: void
      }
      current_quota_date: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}

// Convenience aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type DatingRequest = Database['public']['Tables']['dating_requests']['Row']
export type DatingRequestInsert = Database['public']['Tables']['dating_requests']['Insert']

export type Match = Database['public']['Tables']['matches']['Row']

export type InviteCode = Database['public']['Tables']['invite_codes']['Row']

export type RequestQuota = Database['public']['Tables']['request_quotas']['Row']
export type SmsNotification = Database['public']['Tables']['sms_notifications']['Row']
export type ReferralPayout = Database['public']['Tables']['referral_payouts']['Row']
export type ReferralEarning = Database['public']['Tables']['referral_earnings']['Row']

// Profile with computed fields for UI
export interface ProfileView extends Profile {
  age: number
  residence: string
}

// Request with requester profile joined
export interface RequestWithRequester extends DatingRequest {
  requester: Profile
}

// Match with both profiles joined
export interface MatchWithProfiles extends Match {
  user1: Profile
  user2: Profile
  request: DatingRequest
}
