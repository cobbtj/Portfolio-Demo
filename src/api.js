import axios from 'axios';

const API_BASE = 'https://portfolio-demo-production.up.railway.app/api';

export const getProperties = async (limit = 100, zipCode = null) => {
  const params = { limit };
  if (zipCode) params.zip_code = zipCode;
  
  const response = await axios.get(`${API_BASE}/properties`, { params });
  return response.data;
};

export const getMarketSummary = async () => {
  const response = await axios.get(`${API_BASE}/market-summary`);
  return response.data;
};

export const getZipAnalysis = async () => {
  const response = await axios.get(`${API_BASE}/zip-analysis`);
  return response.data;
};

export const getRecentPermits = async (limit = 25) => {
  const response = await axios.get(`${API_BASE}/recent-permits`, {
    params: { limit }
  });
  return response.data;
};

export const getNYCRecentSales = async (months = 12, limit = 20000) => {
  const response = await axios.get(`${API_BASE}/nyc/recent-sales`, {
    params: { months, limit }
  });
  return response.data;
};

export const getNeighborhoodSales = async (borough, months) => {
  const response = await axios.get(`${API_BASE}/nyc/neighborhoods`, {
    params: { borough, months },
  });
  return response.data;
};







