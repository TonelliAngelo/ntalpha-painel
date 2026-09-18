'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  nome: string;
  role: string;
};

export default function LoggedUser() {
  const client = useMemo(() => supabase(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function carregarUsuario() {
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!active) return;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await client
        .from('profiles')
        .select('nome, role')
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (data) {
        setProfile(data);
      }

      setLoading(false);
    }

    carregarUsuario();

    return () => {
      active = false;
    };
  }, [client]);

  if (loading) {
    return (
      <div className="logged-user">
        <strong>Carregando...</strong>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="logged-user">
        <strong>Usuário conectado</strong>
      </div>
    );
  }

  return (
    <div className="logged-user">
      <span>Usuário conectado</span>

      <strong>{profile.nome}</strong>

      <small>{profile.role}</small>
    </div>
  );
}
