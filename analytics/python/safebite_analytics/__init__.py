"""SafeBite analytics toolkit.

Reads the Power BI CSV extracts in ``public/powerbi`` and reproduces the governed
KPIs, risk views and data-quality checks. Run ``npm run analytics:datasets``
before using the toolkit.

Example
-------
>>> from safebite_analytics import load_datasets
>>> from safebite_analytics.kpis import compute_kpis, resolve_period
>>> data = load_datasets()
>>> period = resolve_period("last90", now=data.generated_at)
>>> kpis = compute_kpis(data, period)
>>> kpis[0]["name"]
'Registered businesses'
"""

from .loader import Datasets, load_datasets, latest_snapshots, risk_band

__all__ = ["Datasets", "load_datasets", "latest_snapshots", "risk_band"]
__version__ = "1.0.0"
