import axios from 'axios';

// Base URL for API requests
const baseURL = './cmd/';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Functions
export const getConfig = async () => {
  const response = await api.get('getConfig');
  return response.data;
};

export const sendCommand = async (shutter: string, command: string) => {
  const response = await api.post(command, { shutter });
  return response.data;
};

export const setLocation = async (lat: number, lng: number) => {
  const response = await api.post('setLocation', { lat, lng });
  return response.data;
};

export const addShutter = async (name: string, duration: string) => {
  const response = await api.post('addShutter', { name, duration });
  return response.data;
};

export const editShutter = async (id: string, name: string, duration: string) => {
  const response = await api.post('editShutter', { id, name, duration });
  return response.data;
};

export const deleteShutter = async (id: string) => {
  const response = await api.post('deleteShutter', { id });
  return response.data;
};

export const addSchedule = async (params: any) => {
  const response = await api.postForm('addSchedule', params);
  return response.data;
};

export const editSchedule = async (id: string, params: any) => {
  const response = await api.postForm('editSchedule', { id, ...params });
  return response.data;
};

export const deleteSchedule = async (id: string) => {
  const response = await api.postForm('deleteSchedule', { id });
  return response.data;
};

export default api;