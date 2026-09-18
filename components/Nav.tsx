'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
export default function Nav(){const r=useRouter();async function sair(){await supabase().auth.signOut();r.push('/login')}return <aside><div className="brand">NT <b>ALPHA</b><small>PAINEL IMOBILIÁRIO</small></div><nav><Link href="/">Dashboard</Link><Link href="/imoveis">Imóveis</Link><Link href="/imoveis/novo">+ Novo imóvel</Link></nav><button className="ghost" onClick={sair}>Sair</button></aside>}
