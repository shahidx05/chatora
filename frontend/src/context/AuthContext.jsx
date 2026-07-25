import { createContext, useContext, useEffect, useState } from 'react'
import { register, login, getMe } from '../services/auth.service'

const AuthContext = createContext({})

export const useAuth = () => {
    return useContext(AuthContext)
}

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token') || '')
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true);

    const fetchUserProfile = async () => {
        try {
            if (token) {
                const data = await getMe()
                setUser(data.user)
            }
        } catch (error) {
            setUser(null)
            Logout();
            console.log("fetchUserProfile error:", error);
        } finally {
            setLoading(false);
        }

    }

    useEffect(() => {
        if (!token) {
            setLoading(false)
            return
        }
        if (user) {         
            setLoading(false)
            return
        }
        fetchUserProfile()
    }, [token])


    const Register = async (name, username, email, password) => {
        const data = await register(name, username, email, password)
        if (data.token) {
            localStorage.setItem("token", data.token);
            setToken(data.token);
            setUser(data.user)
        }
        return data
    }

    const Login = async (email, password) => {
        const data = await login(email, password)
        if (data.token) {
            localStorage.setItem("token", data.token);
            setToken(data.token);
            setUser(data.user)
        }
        return data
    }

    const Logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken('');
        setUser(null)
    };

    const value = {
        Register,
        Login,
        token,
        isLoggedIn: !!user,
        loading,
        fetchUserProfile,
        user,
        setUser,
        Logout,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext