import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/common/Loader";

const ProtectedRoute = () => {
    const { isLoggedIn, loading } = useAuth();

    if (loading) {
        return <Loader text="Loading your chats..." />;
    }

    return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;