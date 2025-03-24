import axios from "axios";
import { config } from "../config";

export const getFromUltron = async (route: string, data: any) => {
  const url = `${config.ultronBaseUrl}/${route}`;
  const response = await axios.post(url, data);
  return response.data;
};
