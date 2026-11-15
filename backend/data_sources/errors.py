class DataSourceError(Exception):
    """Raised when a data source cannot give us data.

    source:  short name of the data source, for example "nasa_power",
             "soilgrids" or "modis_ndvi"
    message: plain-language reason, for example "timed out after 60 s"
    """

    def __init__(self, source: str, message: str):
        self.source = source
        self.message = message
        super().__init__(f"{source}: {message}")
