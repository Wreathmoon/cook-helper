import { redirect } from 'next/navigation';

/** 没有登录页了，打开就直接进推荐 */
export default function Home() {
  redirect('/recommend');
}
