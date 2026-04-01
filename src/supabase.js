import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://emicujhqocsmefcvgfjz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtaWN1amhxb2NzbWVmY3ZnZmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDYyNzAsImV4cCI6MjA5MDU4MjI3MH0.1aQEdNVqKaQlfFMoRy0c_7zCM8i2ulIA5LEF9qtWq54'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function loadData() {
  const { data, error } = await supabase
    .from('planner_data')
    .select('*')
    .eq('id', 'main')
    .single()
  if (error || !data) return null
  return data
}

export async function saveData(projects, pocket, events) {
  const { error } = await supabase
    .from('planner_data')
    .upsert({ id: 'main', projects, pocket, events, updated_at: new Date().toISOString() })
  if (error) console.error('Save error:', error)
}