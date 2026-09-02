import { Fragment, useEffect, useState } from "react";
import {
  Bookmark,
  CircleAlert,
  ChevronUp,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  getLatestRun,
  getListings,
  getSources,
  setListingSaved,
  startCollection,
} from "./api";
import type { CollectionRun, Listing, Source } from "./types";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPostedDate(value: string | null): string {
  if (!value) {
    return "Not provided";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getFreshness(
  lastSeenAt: string,
  now = new Date(),
): {
  label: string;
  className: string;
} {
  const ageInDays = Math.max(
    0,
    (now.getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (ageInDays < 14) {
    return { label: "Latest", className: "freshness-latest" };
  }
  if (ageInDays < 28) {
    return { label: "2 weeks+", className: "freshness-two-weeks" };
  }
  if (ageInDays < 60) {
    return { label: "1 month+", className: "freshness-one-month" };
  }
  return { label: "2 months+", className: "freshness-two-months" };
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [run, setRun] = useState<CollectionRun | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [freshnessFilter, setFreshnessFilter] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState("");
  const [sortBy, setSortBy] = useState("freshness");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getListings(), getLatestRun(), getSources()])
      .then(([nextListings, latestRun, nextSources]) => {
        if (!active) return;
        setListings(nextListings);
        setRun(latestRun);
        setSources(nextSources);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load data.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (run?.status !== "running") return;

    const timer = window.setInterval(() => {
      getLatestRun()
        .then((latestRun) => {
          setRun(latestRun);
          if (latestRun?.status !== "running") {
            setCollecting(false);
            void getListings().then((nextListings) => {
              setListings(nextListings);
              setSelectedListing(null);
            });
          }
        })
        .catch((pollError: unknown) => {
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Unable to refresh collection status.",
          );
          setCollecting(false);
        });
    }, 750);

    return () => window.clearInterval(timer);
  }, [run?.status]);

  async function handleCollection(): Promise<void> {
    setError(null);
    setCollecting(true);
    try {
      setRun(await startCollection());
    } catch (collectionError) {
      setError(
        collectionError instanceof Error
          ? collectionError.message
          : "Unable to start collection.",
      );
      setCollecting(false);
    }
  }

  async function handleSearch(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      setListings(await getListings(search.trim()));
      setSelectedListing(null);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed.",
      );
    }
  }

  async function handleSave(listing: Listing): Promise<void> {
    setSavingId(listing.id);
    setError(null);
    try {
      const updatedListing = await setListingSaved(listing.id, !listing.saved);
      setListings((currentListings) =>
        currentListings.map((currentListing) =>
          currentListing.id === updatedListing.id
            ? updatedListing
            : currentListing,
        ),
      );
      setSelectedListing((currentListing) =>
        currentListing?.id === updatedListing.id
          ? updatedListing
          : currentListing,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save listing.",
      );
    } finally {
      setSavingId(null);
    }
  }

  function clearFilters(): void {
    setSourceFilter("");
    setLocationFilter("");
    setFreshnessFilter("");
    setEmploymentFilter("");
    setSavedOnly(false);
    setSortBy("freshness");
  }

  const locations = [
    ...new Set(
      listings
        .map((listing) => listing.location)
        .filter((location): location is string => Boolean(location)),
    ),
  ].sort();
  const employmentTypes = [
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
  ] as const;
  const filteredListings = [...listings]
    .filter((listing) => {
      const freshness = getFreshness(listing.lastSeenAt).className;
      return (
        (!sourceFilter || listing.sourceId === sourceFilter) &&
        (!locationFilter || listing.location === locationFilter) &&
        (!freshnessFilter || freshness === freshnessFilter) &&
        (!employmentFilter || listing.employmentType === employmentFilter) &&
        (!savedOnly || listing.saved)
      );
    })
    .sort((left, right) => {
      if (sortBy === "posted") {
        return (right.postedAt ?? "").localeCompare(left.postedAt ?? "");
      }
      if (sortBy === "company") {
        return left.companyName.localeCompare(right.companyName);
      }
      if (sortBy === "title") {
        return left.title.localeCompare(right.title);
      }
      return getFreshness(left.lastSeenAt).className.localeCompare(
        getFreshness(right.lastSeenAt).className,
      );
    });

  return (
    <div className="app-shell">
      <main>
        <header className="page-header">
          <div>
            <p className="eyebrow">New Zealand software roles</p>
            <h1>Job Finder</h1>
          </div>
          <div className="refresh-control">
            <span className="refresh-timestamp">
              Last refreshed {formatTimestamp(run?.completedAt ?? null)}
            </span>
            <button
              className="primary-action"
              disabled={collecting || run?.status === "running"}
              onClick={() => void handleCollection()}
              type="button"
            >
              <RefreshCw
                className={
                  collecting || run?.status === "running" ? "spin" : ""
                }
                size={18}
                aria-hidden="true"
              />
              {collecting || run?.status === "running"
                ? "Refreshing"
                : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            {error}
          </div>
        )}

        <section className="listings-section">
          <div className="section-toolbar">
            <div>
              <p className="eyebrow">Current results</p>
              <h2>Software roles ({filteredListings.length})</h2>
            </div>
            <form
              className="search-form"
              onSubmit={(event) => void handleSearch(event)}
            >
              <Search size={18} aria-hidden="true" />
              <label className="sr-only" htmlFor="job-search">
                Search roles
              </label>
              <input
                id="job-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, company, or location"
                type="search"
                value={search}
              />
              <button type="submit">Search</button>
            </form>
          </div>

          <div className="listing-filters" aria-label="Listing filters">
            <label>
              Source
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Freshness
              <select
                value={freshnessFilter}
                onChange={(event) => setFreshnessFilter(event.target.value)}
              >
                <option value="">Any age</option>
                <option value="freshness-latest">Latest</option>
                <option value="freshness-two-weeks">2 weeks+</option>
                <option value="freshness-one-month">1 month+</option>
                <option value="freshness-two-months">2 months+</option>
              </select>
            </label>
            <label>
              Employment type
              <select
                value={employmentFilter}
                onChange={(event) => setEmploymentFilter(event.target.value)}
              >
                <option value="">Any type</option>
                {employmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort by
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="freshness">Freshness</option>
                <option value="posted">Posted date</option>
                <option value="company">Company</option>
                <option value="title">Role title</option>
              </select>
            </label>
            <label className="checkbox-filter">
              <input
                checked={savedOnly}
                onChange={(event) => setSavedOnly(event.target.checked)}
                type="checkbox"
              />
              Saved only
            </label>
            <button
              className="clear-filters"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>

          {loading ? (
            <div className="empty-state" aria-live="polite">
              <RefreshCw className="spin" size={24} aria-hidden="true" />
              <strong>Loading roles</strong>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="empty-state">
              <strong>
                {listings.length === 0
                  ? "No roles found yet"
                  : "No roles match these filters"}
              </strong>
              <p>
                {listings.length === 0
                  ? "Select Refresh to check for current vacancies."
                  : "Clear a filter to see more roles."}
              </p>
            </div>
          ) : (
            <div className="listing-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Posted</th>
                    <th>Freshness</th>
                    <th aria-label="Open source" />
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map((listing) => {
                    const freshness = getFreshness(listing.lastSeenAt);
                    return (
                      <Fragment key={listing.id}>
                        <tr
                          className={
                            selectedListing?.id === listing.id ? "selected" : ""
                          }
                          key={listing.id}
                          onClick={() => setSelectedListing(listing)}
                        >
                          <td>
                            <strong>{listing.title}</strong>
                          </td>
                          <td>{listing.companyName}</td>
                          <td>
                            <span className="location">
                              <MapPin size={14} aria-hidden="true" />
                              {listing.location ?? "Not provided"}
                            </span>
                          </td>
                          <td>{formatPostedDate(listing.postedAt)}</td>
                          <td>
                            <span
                              className={`freshness ${freshness.className}`}
                            >
                              {freshness.label}
                            </span>
                          </td>
                          <td>
                            <div className="listing-actions">
                              <button
                                aria-label={
                                  listing.saved
                                    ? `Unsave ${listing.title}`
                                    : `Save ${listing.title}`
                                }
                                className={`icon-link save-button ${listing.saved ? "saved" : ""}`}
                                disabled={savingId === listing.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleSave(listing);
                                }}
                                title={
                                  listing.saved
                                    ? "Unsave listing"
                                    : "Save listing"
                                }
                                type="button"
                              >
                                <Bookmark
                                  size={17}
                                  fill={listing.saved ? "currentColor" : "none"}
                                  aria-hidden="true"
                                />
                              </button>
                              <a
                                className="icon-link"
                                href={listing.sourceUrl}
                                rel="noreferrer"
                                target="_blank"
                                title="Open original listing"
                              >
                                <ExternalLink size={17} aria-hidden="true" />
                                <span className="sr-only">
                                  Open {listing.title}
                                </span>
                              </a>
                            </div>
                          </td>
                        </tr>
                        {selectedListing?.id === listing.id && (
                          <tr className="listing-detail-row">
                            <td colSpan={6}>
                              <section
                                className="inline-listing-detail"
                                aria-labelledby={`listing-detail-title-${listing.id}`}
                              >
                                <div>
                                  <p className="eyebrow">Role details</p>
                                  <h2 id={`listing-detail-title-${listing.id}`}>
                                    {listing.title}
                                  </h2>
                                </div>
                                <dl>
                                  <div>
                                    <dt>Company</dt>
                                    <dd>{listing.companyName}</dd>
                                  </div>
                                  <div>
                                    <dt>Location</dt>
                                    <dd>
                                      {listing.location ?? "Not provided"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Posted</dt>
                                    <dd>
                                      {formatPostedDate(listing.postedAt)}
                                    </dd>
                                  </div>
                                </dl>
                                <p>
                                  {listing.summary ??
                                    "Open the original listing for the full job description."}
                                </p>
                                <button
                                  aria-label={
                                    listing.saved
                                      ? `Unsave ${listing.title}`
                                      : `Save ${listing.title}`
                                  }
                                  className={`detail-save-button ${listing.saved ? "saved" : ""}`}
                                  disabled={savingId === listing.id}
                                  onClick={() => void handleSave(listing)}
                                  type="button"
                                >
                                  <Bookmark
                                    size={17}
                                    fill={
                                      listing.saved ? "currentColor" : "none"
                                    }
                                    aria-hidden="true"
                                  />
                                  {listing.saved ? "Saved" : "Save listing"}
                                </button>
                              </section>
                              <button
                                className="collapse-action"
                                onClick={() => setSelectedListing(null)}
                                aria-label="Collapse details"
                                title="Collapse details"
                                type="button"
                              >
                                <ChevronUp size={18} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
