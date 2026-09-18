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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function carregarUsuario() {
      try {
        const {
          data: { user },
          error: userError,
        } = await client.auth.getUser();

        if (!active) return;

        if (userError || !user) {
          console.error('Erro ao identificar usuário:', userError);
          setLoading(false);
          return;
        }

        setEmail(user.email ?? '');

        const { data, error } = await client
          .from('profiles')
          .select('nome, role')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('Erro ao carregar profile:', error);
          setLoading(false);
          return;
        }

        if (data) {
          setProfile({
            nome: data.nome,
            role: data.role,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro inesperado ao carregar usuário:', error);

        if (active) {
          setLoading(false);
        }
      }
    }

    carregarUsuario();

    return () => {
      active = false;
    };
  }, [client]);

  if (loading) {
    return (
      <div className="logged-user">
        <span>Usuário conectado</span>
        <strong>Carregando...</strong>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="logged-user">
        <span>Usuário conectado</span>
        <strong>{email || 'Perfil não localizado'}</strong>
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
