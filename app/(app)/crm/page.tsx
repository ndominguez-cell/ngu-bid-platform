import { createClient } from '@/lib/supabase/server';
import CRMClient from './CRMClient';

export const revalidate = 0;

export default async function CRMPage() {
  const supabase = createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, companies(name, type)')
    .order('created_at', { ascending: false });

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  return (
    <CRMClient
      contacts={contacts ?? []}
      companies={companies ?? []}
    />
  );
}
