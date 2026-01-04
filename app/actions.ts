'use server';

import { supabase } from '@/lib/supabase';

export async function subscribeUser(formData: FormData) {
  const email = formData.get('email') as string;
  const source = formData.get('source') as string || 'landing_page';

  if (!email) {
    return { error: 'Email is required' };
  }

  try {
    const { error } = await supabase
      .from('curator_interest_signups')
      .insert({
        user_email: email,
        interest_type: 'waitlist',
        source: source,
        subscribed: true,
        processed: false,
      });

    if (error) {
      console.error('Supabase error:', error);
      // Check for unique constraint violation or other specific errors if needed
      if (error.code === '23505') { // Unique violation code for Postgres
         return { error: 'You are already subscribed!' };
      }
      return { error: 'Something went wrong. Please try again.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
