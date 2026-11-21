import axioS from "axios";

// withCredentials: the share page's unlock cookie must reach the API, which runs
// on another origin locally (same origin in production).
const axios = axioS.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, withCredentials: true });

export default axios;
