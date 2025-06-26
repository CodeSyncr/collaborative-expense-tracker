"use client";

import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InstallPrompt from "@/components/InstallPrompt";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <p>Loading...</p>
      </main>
    );
  }

  if (user) {
    return null; // or a loading spinner while redirecting
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Logo and branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              Expense Tracker
            </h1>
            <p className="text-purple-200 text-lg">
              Collaborate and track expenses with your team seamlessly
            </p>
          </div>

          {/* Features preview */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <TrendingUp className="w-6 h-6 text-purple-300 mb-2" />
              <p className="text-white text-sm font-medium">
                Real-time Analytics
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
              <Users className="w-6 h-6 text-purple-300 mb-2" />
              <p className="text-white text-sm font-medium">
                Team Collaboration
              </p>
            </div>
          </div>

          {/* Sign in card */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardContent className="p-8">
              <Link
                href="/dashboard"
                className="flex w-full items-center justify-center"
              >
                <Button
                  onClick={handleSignIn}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 py-4 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Image
                    src="/google_icon.png"
                    alt="Google"
                    width={24}
                    height={24}
                    className="mr-3"
                  />
                  Continue with Google
                </Button>
              </Link>
              <p className="text-center text-purple-200 text-sm mt-4">
                Secure authentication powered by Google
              </p>
            </CardContent>
          </Card>
          <InstallPrompt />
        </div>
      </div>
    </div>
  );
}
