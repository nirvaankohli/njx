import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import LandingPage from "./docshield/LandingPage";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;

  return <LandingPage />;
};

export default Index;
