import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
axios.defaults.baseURL = API_URL;
axios.interceptors.request.use(
  (config) => {
    config.headers["Content-Type"] = "application/json";
    config.headers["Accept"] = "application/json";

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default axios;
