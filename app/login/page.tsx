'use client';
import Image from 'next/image';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
export default function Login(){
 const [email,setEmail]=useState('');const [senha,setSenha]=useState('');const [erro,setErro]=useState('');const r=useRouter();
 async function entrar(e:FormEvent){e.preventDefault();setErro('');const {error}=await supabase().auth.signInWithPassword({email,password:senha});if(error)return setErro('Usuário ou senha inválidos.');r.push('/')}
 return <main className="login"><form className="login-card" onSubmit={entrar}>
  <div className="login-logo"><Image src="/images/ntalpha-logo-footer.png" alt="NT ALPHA Consultor Imobiliário" width={280} height={160} priority/></div>
  <h1>Acesso ao painel</h1><p className="login-subtitle">Entre com suas credenciais para continuar</p>
  <label>E-mail<input type="email" placeholder="Seu e-mail" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Senha<input type="password" placeholder="Sua senha" autoComplete="current-password" required value={senha} onChange={e=>setSenha(e.target.value)}/></label>
  {erro&&<p className="error">{erro}</p>}<button>Entrar →</button><div className="login-security">Acesso seguro e protegido</div>
 </form></main>
}