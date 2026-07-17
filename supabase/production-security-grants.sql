-- Ferme les droits anonymes ajoutes par les privileges par defaut Supabase.

revoke all on function public.mienra_next_student_matricule(text, text, text) from public;
revoke all on function public.mienra_next_student_matricule(text, text, text) from anon;
grant execute on function public.mienra_next_student_matricule(text, text, text) to authenticated;

revoke all on function public.mienra_reset_number_counters(text, text) from public;
revoke all on function public.mienra_reset_number_counters(text, text) from anon;
grant execute on function public.mienra_reset_number_counters(text, text) to authenticated;
