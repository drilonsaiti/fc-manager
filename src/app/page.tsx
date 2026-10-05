"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/LoadingSpinner";

export default function Home() {
  const { userId, member, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(userId && member ? "/dashboard" : "/login");
  }, [userId, member, loading, router]);
  return <PageLoader />;
}
