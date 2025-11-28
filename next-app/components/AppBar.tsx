"use client"

import { signIn, signOut, useSession } from "next-auth/react";

export default function AppBar() {
  const session = useSession()
  return (
    <div className="flex justify-between">
      <div>Track Up</div>
      <div>
        {!session.data?.user && <button onClick={() => signIn()}>Login</button>}
        {session.data?.user && <button onClick={() => signOut()}>Logout </button>}
      </div>
    </div>
  )
}
