# Data sources

Datasets used by Hindsight, how we accessed them, and what we used them for.
Access date for all sources: 2026-11-14.

## 1. NASA POWER daily weather (used)

- **Name:** NASA Prediction Of Worldwide Energy Resources (POWER), daily point API, AG community
- **Provider:** NASA Langley Research Center (LaRC) POWER Project
- **URL:** https://power.larc.nasa.gov/ (API: https://power.larc.nasa.gov/api/temporal/daily/point)
- **Variables:** T2M_MAX, T2M_MIN (C), PRECTOTCORR (mm/day), ALLSKY_SFC_SW_DWN (MJ/m^2/day), RH2M (%), WS2M (m/s), GWETROOT (0-1). Units were checked against the API reply; no conversion was needed.
- **Coverage used:** 1984-01-01 to 2024-12-31, daily; 14,976 days per site, 14,965 after removing 29 February.
- **Resolution:** meteorology from MERRA-2 (0.5 x 0.625 degree cells), solar from CERES (1 x 1 degree cells, per the project blueprint).
- **Use in the app:** daily weather for the water balance and season index (ClimateSeries, spec 4.1).
- **Limitations:** NASA POWER values are grid-cell estimates and not field measurements. A cell covers about 50 km, so a single field can differ, especially for rainfall.
- **Data quality at the demo sites:** no missing values (-999) at any site, so no gap filling was needed (filled_counts is empty).
- **Note:** the Chakwal series contains one day with 329.64 mm of rain. It is in the NASA reply and was kept unchanged.
- **Credit:** "This data was obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program."

### Demo-site summary (1984-2024, from our cached files)

| Site | lat, lon | Grid elevation (m) | Mean yearly rain (mm) | Mean temperature (C) | Wettest day (mm) |
|---|---|---|---|---|---|
| Chakwal, Pakistan | 32.93, 72.86 | 448.45 | 804 | 23.8 | 329.6 |
| Sheikhupura, Pakistan | 31.71, 73.98 | 196.55 | 483 | 26.4 | 118.5 |
| Ames, Iowa, USA | 42.03, -93.63 | 310.22 | 857 | 9.6 | 73.5 |

Mean temperature is the average of daily maximum and minimum. 
### Comparison with published climate normals (checked 2026-11-14)

| Site | NASA POWER 1984-2024 | Reference | Difference |
|---|---|---|---|
| Chakwal | 804 mm, 23.8 C | 544 mm, 21.9 C (WorldClim 2.1 grid, 1970-2000; no official PMD station normal found) | rain about +48 %, temperature +1.9 C |
| Sheikhupura (vs Lahore station, ~35 km away) | 483 mm, 26.4 C | 758.8 mm, 24.9 C (Lahore, WMO/NOAA normals 1991-2020) | rain about -36 %, temperature +1.5 C |
| Ames | 857 mm, 9.6 C | about 37 in (~940 mm) (NOAA 1991-2020 normals at Ankeny, ~34 km away) | rain about -9 %; temperature not checked |

**What this means:** temperature agrees within about 2 C. Rainfall agrees well for Ames but differs strongly for both Pakistan sites, in opposite directions: NASA POWER is wetter than the reference at Chakwal and drier than Lahore at Sheikhupura. A single 0.5 x 0.625 degree cell cannot resolve the rainfall difference between the Pothwar uplands and the Punjab plains, and the Chakwal reference is itself a gridded estimate. Hindsight results for Chakwal should therefore be read as relative comparisons between rotations, not as exact local water amounts. The data were not adjusted.

Reference sources:
- Chakwal: WorldClim 2.1 as summarised at https://www.populationreview.org/climate/pakistan/chakwal
- Lahore: https://en.wikipedia.org/wiki/Climate_of_Lahore (cites NOAA WMO 1991-2020 normals)
- Ames: https://www.climate-zone.com/climate/us/ames/ (NOAA U.S. Climate Normals 1991-2020, station USC00130241)

## 2. SoilGrids soil properties (used, optional)

- **Name:** SoilGrids 2.0 (SoilGrids250m), properties/query REST API
- **Provider:** ISRIC - World Soil Information
- **URL:** https://rest.isric.org/soilgrids/v2.0/properties/query
- **Variables:** clay, sand (g/kg), soc (dg/kg), phh2o (pH x 10), at 0-5, 5-15 and 15-30 cm; each divided by its d_factor (10).
- **Processing:** thickness-weighted mean over 0-30 cm; organic carbon % x 1.724 = organic matter %; USDA texture class from sand and clay.
- **Resolution:** 250 m.
- **Use in the app:** optional pre-fill of the farmer's soil (SoilProfile, spec 4.2). If it fails or has no data, the farmer's texture is used.
- **Limitations:** the service is in beta and timed out on about 2 of 5 test requests. It returned no data at the Chakwal and Sheikhupura demo points; it returned a profile for Ames. Soil depth is not taken from SoilGrids (depth_cm is null).
- **Licence:** CC-BY-4.0.
- **Citation:** Poggio, L., de Sousa, L. M., Batjes, N. H., Heuvelink, G. B. M., Kempen, B., Ribeiro, E., and Rossiter, D.: SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty, SOIL, 7, 217-240, 2021. https://doi.org/10.5194/soil-7-217-2021

## 3. MODIS NDVI (used, optional check)

- **Name:** MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061 (MOD13Q1)
- **Provider:** NASA Land Processes DAAC; accessed through the ORNL DAAC MODIS web service
- **URL:** https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset
- **Variables:** 250m_16_days_NDVI (scale 0.0001, fill -3000) and 250m_16_days_pixel_reliability (0 = good).
- **Coverage used:** 2001-2024, 552 composite dates per site.
- **Resolution:** 250 m, 16-day composites.
- **Use in the app:** optional check of the season index against observed vegetation greenness (NdviSeries, spec 4.3).
- **Limitations:** a 250 m pixel can mix several fields; cloudy dates are flagged as not good quality. The service was slow (30-50 s per request) with frequent HTTP 502/503 errors.
- **Citation:** Didan, K., 2021, MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061 [dataset], NASA Land Processes DAAC, accessed 2026-11-14 at https://doi.org/10.5067/MODIS/MOD13Q1.061
- **Service citation:** ORNL DAAC. 2018. Terrestrial Ecology Subsetting & Visualization Services (TESViS) RESTful Web Service. ORNL DAAC, Oak Ridge, Tennessee, USA. https://doi.org/10.3334/ORNLDAAC/1600

### NDVI files delivered (2001-2024, 552 dates each)

| File | Point | NDVI min-max | Good-quality dates | Note |
|---|---|---|---|---|
| ndvi_32.93_72.95.json | Chakwal farm point (about 9 km east of the weather point) | 0.07-0.63 | 461 | Use this one for the Chakwal validation check |
| ndvi_32.93_72.86.json | Chakwal preset point | 0.10-0.25 | 145 | Pixel is mostly town, not cropland; kept for offline use only |
| ndvi_31.71_73.98.json | Sheikhupura | 0.02-0.48 | 242 | |
| ndvi_42.03_-93.63.json | Ames | -0.01-0.91 | 396 | |

## Credits list (for the project page)

- NASA Langley Research Center POWER Project (daily weather)
- ISRIC - World Soil Information, SoilGrids 2.0 (soil properties)
- NASA LP DAAC MODIS MOD13Q1 v061 via ORNL DAAC (vegetation index)
