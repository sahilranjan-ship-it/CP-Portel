
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase env vars missing')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCount() {
    const { count, error } = await supabase
        .from('cp_master')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Error fetching count:', error)
    } else {
        console.log('Total CPs in public.cp_master:', count)
    }
}

checkCount()
