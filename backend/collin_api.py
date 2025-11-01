import requests
import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class CollinRealEstateAPI:
    """Austin Open Data Portal API wrapper for real estate data"""
    
    BASE_URL = "https://data.austintexas.gov/resource"
    
    # Key datasets
    ENDPOINTS = {
        "properties": "nne4-8riu.json",  # Real Property Appraisals
        "permits": "3syk-w9eu.json",     # Building Permits
        "violations": "b4k4-adkb.json"   # Code Violations
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Austin-Real-Estate-Dashboard/1.0'
        })
    
    def get_properties(self, limit: int = 100, zip_code: Optional[str] = None, 
                      min_value: Optional[float] = None) -> List[Dict]:
        """Fetch Austin property appraisal data"""
        
        url = f"{self.BASE_URL}/{self.ENDPOINTS['properties']}"
        params = {"$limit": limit}
        
        # Add filters
        if zip_code:
            params["postal_code"] = zip_code
        
        if min_value:
            params["$where"] = f"appraised_total_value > {min_value}"
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            
            raw_data = response.json()
            print("RAW RESPONSE COUNT:", len(raw_data))
            print("SAMPLE:", raw_data[:2])
            return self._clean_property_data(raw_data)
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch properties: {e}")
            return []
    
    def get_market_summary(self) -> Dict:
        """Get market-wide statistics"""
        
        # Fetch larger dataset for analysis
        properties = self.get_properties(limit=5000)
        
        if not properties:
            return {"error": "No data available"}
        
        df = pd.DataFrame(properties)
        
        # Calculate key metrics
        summary = {
            "total_properties": len(df),
            "average_value": round(df['appraised_value'].mean(), 2),
            "median_value": round(df['appraised_value'].median(), 2),
            "min_value": round(df['appraised_value'].min(), 2),
            "max_value": round(df['appraised_value'].max(), 2),
            "last_updated": datetime.now().isoformat()
        }
        
        return summary
    
    def get_zip_analysis(self) -> List[Dict]:
        """Analyze properties by ZIP code"""
        
        properties = self.get_properties(limit=3000)
        
        if not properties:
            return []
        
        df = pd.DataFrame(properties)
        
        # Group by ZIP code
        zip_stats = df.groupby('zip_code').agg({
            'appraised_value': ['mean', 'median', 'count'],
            'square_feet': 'mean'
        }).round(2)
        
        # Flatten column names
        zip_stats.columns = ['avg_value', 'median_value', 'property_count', 'avg_sqft']
        zip_stats = zip_stats.reset_index()
        
        # Filter out zips with < 10 properties
        zip_stats = zip_stats[zip_stats['property_count'] >= 10]
        
        return zip_stats.to_dict('records')
    
    def get_recent_permits(self, limit: int = 50) -> List[Dict]:
        """Get recent building permits (shows market activity)"""
        
        url = f"{self.BASE_URL}/{self.ENDPOINTS['permits']}"
        params = {
            "$limit": limit,
            "$order": "issued_date DESC"
        }
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            
            raw_data = response.json()
            print("RAW PERMIT DATA SAMPLE:", raw_data[:3])  # <-- ADD THIS
            return self._clean_permit_data(raw_data)
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch permits: {e}")
            return []
    
    def _clean_property_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Clean and standardize property data"""
        
        cleaned = []
        
        for prop in raw_data:
            try:
                cleaned_prop = {
                    "id": prop.get("account_number", ""),
                    "address": self._format_address(prop),
                    "zip_code": prop.get("postal_code", ""),
                    "appraised_value": float(prop.get("prevvalmarket") or prop.get("prevvalappraised") or 0),
                    "land_value": float(prop.get("appraised_land_value", 0)),
                    "building_value": float(prop.get("appraised_building_value", 0)),
                    "property_type": prop.get("property_type_code", "Unknown"),
                    "year_built": prop.get("year_built", ""),
                    "square_feet": float(prop.get("building_square_feet", 0)) if prop.get("building_square_feet") else 0,
                    "lot_size": float(prop.get("land_area_square_feet", 0)) if prop.get("land_area_square_feet") else 0
                }
                
                # Only include properties with valid data
                if cleaned_prop["appraised_value"] > 0:
                    cleaned.append(cleaned_prop)
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping invalid property data: {e}")
                continue
        
        return cleaned
    
    def _clean_permit_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Clean building permit data"""
        
        cleaned = []
        
        for permit in raw_data:
            try:
                cleaned_permit = {
                    "permit_id": permit.get("permit_number", ""),
                    "address": permit.get("original_address1", ""),
                    "permit_type": permit.get("permit_type", ""),
                    "work_description": permit.get("work_description", ""),
                    "issued_date": permit.get("issued_date", ""),
                    "estimated_cost": float(permit.get("estimated_cost", 0)) if permit.get("estimated_cost") else 0
                }
                
                cleaned.append(cleaned_permit)
                
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping invalid permit data: {e}")
                continue
        
        return cleaned
    
    def _format_address(self, prop: Dict) -> str:
        """Format property address consistently"""
        
        address_parts = []
        
        if prop.get("property_address"):
            address_parts.append(prop["property_address"])
        
        address_parts.append("Austin, TX")
        
        if prop.get("postal_code"):
            address_parts.append(prop["postal_code"])
        
        return ", ".join(address_parts)

# Global instance
collin_api = CollinRealEstateAPI()