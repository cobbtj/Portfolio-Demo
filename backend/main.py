from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from collin_api import collin_api  
from nyc_api import nyc_api

app = FastAPI(title="Austin Real Estate Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/properties")
async def get_properties(limit: int = 100, zip_code: str = None):
    """Get Austin properties with optional ZIP filter"""
    properties = collin_api.get_properties(limit=limit, zip_code=zip_code)
    return {"properties": properties, "total": len(properties)}

@app.get("/api/market-summary")
async def get_market_summary():
    """Get market summary statistics"""
    return collin_api.get_market_summary()

@app.get("/api/zip-analysis")
async def get_zip_analysis():
    """Get analysis by ZIP code"""
    return collin_api.get_zip_analysis()

@app.get("/api/recent-permits")
async def get_recent_permits(limit: int = 50):
    """Get recent building permits"""
    permits = collin_api.get_recent_permits(limit=limit)
    return {"permits": permits, "total": len(permits)}

@app.get("/api/nyc/recent-sales")
async def nyc_recent_sales(months: int = 12, pages: int = 5):
    try:
        data = nyc_api.get_recent_sales_by_borough(months=months)
        return {"boroughs": data, "total": len(data)}
    except Exception as e:
        return {"error": str(e), "boroughs": [], "total": 0}

@app.get("/api/nyc/neighborhoods")
async def nyc_neighborhoods(borough: str, months: int = 12):
    try:
        data = nyc_api.get_neighborhood_breakdown(borough, months)
        return {"neighborhoods": data, "total": len(data)}
    except Exception as e:
        return {"error": str(e), "neighborhoods": [], "total": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)