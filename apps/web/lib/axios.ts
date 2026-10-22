import axioS from "axios";

const axios = axioS.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

export default axios;
