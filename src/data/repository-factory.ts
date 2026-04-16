import { isSupabaseConfigured } from '../lib/supabase'
import { demoRepository } from './demo-repository'
import type { AppRepository } from './repository'
import { supabaseRepository } from './supabase-repository'

export function getAppRepository(): AppRepository {
  return isSupabaseConfigured ? supabaseRepository : demoRepository
}
