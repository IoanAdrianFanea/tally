type LogParams = {
  team_id: string
  user_id: string
  action_type: string
  card_id?: string | null  // optional, can be null
  metadata?: Record<string, unknown>  // optional object
}

export async function logActivity(supabase: any, params: LogParams) {
  const { team_id, user_id, action_type, card_id, metadata } = params
  const { data, error } = await supabase
    .from('activity_log')
    .insert(params)
  
  if (error) {
    console.error('Activity log error:', error.message, error)
  }

}