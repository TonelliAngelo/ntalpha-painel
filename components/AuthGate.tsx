'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
export default function AuthGate({children}:{children:ReactNode}){
 const pathname=usePathname();const router=useRouter();const client=useMemo(()=>supabase(),[]);const [liberado,setLiberado]=useState(false);
 useEffect(()=>{let ativo=true;async function validar(){setLiberado(false);const {data:{user}}=await client.auth.getUser();if(!ativo)return;const login=pathname==='/login';if(!user&&!login){router.replace('/login');return}if(user&&login){router.replace('/');return}setLiberado(true)}validar();const {data:{subscription}}=client.auth.onAuthStateChange((_e,session)=>{const login=pathname==='/login';if(!session&&!login){setLiberado(false);router.replace('/login');return}if(session&&login){setLiberado(false);router.replace('/');return}setLiberado(true)});return()=>{ativo=false;subscription.unsubscribe()}},[client,pathname,router]);
 if(!liberado)return <main className="login"><div className="login-card"><div className="login-logo"><Image src="/images/ntalpha-logo-footer.png" alt="NT ALPHA Consultor Imobiliário" width={260} height={150} priority/></div><p className="login-subtitle">Carregando painel...</p></div></main>;
 return <>{children}</>
}