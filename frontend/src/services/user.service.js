import api from "../api/axios";

export const getUsers = async (query = "") => {
  const response = await api.get("/users", {
    params: { search: query }
  });
  return response.data;
}