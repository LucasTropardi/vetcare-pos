import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarBlankIcon,
  ClockCountdownIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PawPrintIcon,
  StethoscopeIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useNaming } from "../../i18n/useNaming";
import { getApiErrorMessage } from "../../services/api/errors";
import { listAppointments } from "../../services/api/appointments.service";
import { listPets } from "../../services/api/pets.service";
import type {
  AppointmentResponse,
  AppointmentStatus,
  AppointmentType,
  PageResponse,
  PetListItemResponse,
} from "../../services/api/types";
import { showMessage } from "../../store/message.store";
import styles from "./AppointmentsPage.module.css";

type AppointmentFilters = {
  dateFrom: string;
  dateTo: string;
  type: "ALL" | AppointmentType;
  status: "ALL" | AppointmentStatus;
  petId: number | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toBoundaryDateTime(value: string, endOfDay = false) {
  if (!value) return undefined;
  return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function getDefaultFilters(): AppointmentFilters {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  return {
    dateFrom: formatDateInput(lastWeek),
    dateTo: formatDateInput(today),
    type: "ALL",
    status: "ALL",
    petId: null,
  };
}

function getAppointmentTypeLabel(naming: ReturnType<typeof useNaming>, type: AppointmentType) {
  return type === "VET" ? naming.t("appointments.typeVet") : naming.t("appointments.typePetshop");
}

function getAppointmentStatusLabel(naming: ReturnType<typeof useNaming>, status: AppointmentStatus) {
  if (status === "OPEN") return naming.t("appointments.statusOpen");
  if (status === "FINISHED") return naming.t("appointments.statusFinished");
  return naming.t("appointments.statusCanceled");
}

function getAppointmentStatusTone(status: AppointmentStatus) {
  if (status === "OPEN") return styles.statusInfo;
  if (status === "FINISHED") return styles.statusSuccess;
  return styles.statusDanger;
}

function formatPetOptionLabel(pet: PetListItemResponse) {
  return pet.tutorName ? `${pet.name} • ${pet.tutorName}` : pet.name;
}

export function AppointmentsPage() {
  const naming = useNaming();

  const [filters, setFilters] = useState<AppointmentFilters>(() => getDefaultFilters());
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [appointmentsPage, setAppointmentsPage] = useState<PageResponse<AppointmentResponse>>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 12,
  });
  const [petDirectory, setPetDirectory] = useState<Record<number, PetListItemResponse>>({});
  const [petQuery, setPetQuery] = useState("");
  const [petResults, setPetResults] = useState<PetListItemResponse[]>([]);
  const [petLoading, setPetLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentResponse | null>(null);

  useEffect(() => {
    document.title = `${naming.t("appointments.title")} • ${naming.getApp("name")}`;
  }, [naming]);

  useEffect(() => {
    let cancelled = false;

    async function loadPetsDirectory() {
      try {
        const response = await listPets({ page: 0, size: 500, sort: "name,asc" });
        if (cancelled) return;
        setPetDirectory(Object.fromEntries((response.content ?? []).map((pet) => [pet.id, pet])));
      } catch {
        if (!cancelled) {
          setPetDirectory({});
        }
      }
    }

    void loadPetsDirectory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAppointmentsPage() {
      setLoading(true);
      setListUnavailable(false);
      try {
        const response = await listAppointments({
          page,
          size: 12,
          sort: "scheduledStartAt,desc",
          appointmentType: filters.type === "ALL" ? undefined : filters.type,
          status: filters.status === "ALL" ? undefined : filters.status,
          petId: filters.petId ?? undefined,
          scheduledFrom: toBoundaryDateTime(filters.dateFrom),
          scheduledTo: toBoundaryDateTime(filters.dateTo, true),
        });

        if (cancelled) return;
        setAppointmentsPage(response);
      } catch (error) {
        if (!cancelled) {
          if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
            setAppointmentsPage({
              content: [],
              totalElements: 0,
              totalPages: 0,
              number: 0,
              size: 12,
            });
            setListUnavailable(true);
            return;
          }

          showMessage({
            title: naming.t("appointments.title"),
            message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadAppointments"),
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAppointmentsPage();
    return () => {
      cancelled = true;
    };
  }, [filters, naming, page]);

  useEffect(() => {
    const query = petQuery.trim();

    if (filters.petId || query.length < 2) {
      setPetResults([]);
      setPetLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPetLoading(true);
      try {
        const response = await listPets({ page: 0, size: 8, query, sort: "name,asc" });
        if (cancelled) return;
        setPetResults(response.content ?? []);
      } catch {
        if (!cancelled) setPetResults([]);
      } finally {
        if (!cancelled) setPetLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters.petId, petQuery]);

  const pageNumbers = useMemo(() => {
    if (appointmentsPage.totalPages <= 1) return [];
    return Array.from({ length: appointmentsPage.totalPages }, (_, index) => index);
  }, [appointmentsPage.totalPages]);

  const selectedPet = filters.petId ? petDirectory[filters.petId] ?? null : null;

  function updateFilter<K extends keyof AppointmentFilters>(key: K, value: AppointmentFilters[K]) {
    setPage(0);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleResetFilters() {
    setPage(0);
    setFilters(getDefaultFilters());
    setPetQuery("");
    setPetResults([]);
  }

  function handlePetInputChange(value: string) {
    setPetQuery(value);
    setPetResults([]);
    setPage(0);
    setFilters((current) => ({ ...current, petId: null }));
  }

  function handleSelectPet(pet: PetListItemResponse) {
    setPetDirectory((current) => ({ ...current, [pet.id]: pet }));
    setPetQuery(formatPetOptionLabel(pet));
    setPetResults([]);
    setPage(0);
    setFilters((current) => ({ ...current, petId: pet.id }));
  }

  function handleClearPet() {
    setPetQuery("");
    setPetResults([]);
    setPage(0);
    setFilters((current) => ({ ...current, petId: null }));
  }

  function handleOpenDetails(appointment: AppointmentResponse) {
    setSelectedAppointment(appointment);
  }

  function handleCloseDetails() {
    setSelectedAppointment(null);
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.kicker}>{naming.t("sidebar.appointments")}</div>
          <h1>{naming.t("appointments.title")}</h1>
          <p>{naming.t("appointments.description")}</p>
        </div>
        <div className={styles.heroPanel}>
          <span>{naming.t("appointments.periodLabel")}</span>
          <strong>{filters.dateFrom} → {filters.dateTo}</strong>
          <small>{appointmentsPage.totalElements} {naming.t("appointments.resultsCount")}</small>
          <small>{selectedPet ? `${naming.t("home.pet")}: ${selectedPet.name}` : naming.t("appointments.allPets")}</small>
        </div>
      </header>

      <section className={styles.content}>
        <article className={`${styles.card} ${styles.filtersCard}`}>
          <div className={styles.cardHeader}>
            <div>
              <h2>{naming.t("appointments.filtersTitle")}</h2>
              <p>{naming.t("appointments.filtersDescription")}</p>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={handleResetFilters}>
              {naming.t("appointments.resetFilters")}
            </button>
          </div>

          <div className={styles.filtersGrid}>
            <label className={styles.field}>
              <span>{naming.t("appointments.dateFrom")}</span>
              <div className={styles.inputShell}>
                <CalendarBlankIcon size={18} />
                <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
              </div>
            </label>

            <label className={styles.field}>
              <span>{naming.t("appointments.dateTo")}</span>
              <div className={styles.inputShell}>
                <CalendarBlankIcon size={18} />
                <input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
              </div>
            </label>

            <div className={styles.field}>
              <span>{naming.t("appointments.petFilter")}</span>
              <div className={styles.searchField}>
                <div className={styles.inputShell}>
                  <MagnifyingGlassIcon size={18} />
                  <input
                    value={petQuery}
                    onChange={(event) => handlePetInputChange(event.target.value)}
                    placeholder={naming.t("appointments.petPlaceholder")}
                  />
                </div>
                {filters.petId ? (
                  <button className={styles.inlineButton} type="button" onClick={handleClearPet}>
                    {naming.t("appointments.clearPet")}
                  </button>
                ) : null}
                {petLoading ? <div className={styles.searchHint}>{naming.getMessage("loading")}</div> : null}
                {petResults.length > 0 ? (
                  <div className={styles.searchResults}>
                    {petResults.map((pet) => (
                      <button key={pet.id} type="button" className={styles.searchResultItem} onClick={() => handleSelectPet(pet)}>
                        <strong>{pet.name}</strong>
                        <span>{pet.tutorName || `${naming.t("home.tutor")} #${pet.tutorId}`}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <label className={styles.field}>
              <span>{naming.t("appointments.typeFilter")}</span>
              <div className={styles.inputShell}>
                <StethoscopeIcon size={18} />
                <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as AppointmentFilters["type"])}>
                  <option value="ALL">{naming.t("appointments.typeAll")}</option>
                  <option value="VET">{naming.t("appointments.typeVet")}</option>
                  <option value="PETSHOP">{naming.t("appointments.typePetshop")}</option>
                </select>
              </div>
            </label>

            <label className={styles.field}>
              <span>{naming.t("appointments.statusFilter")}</span>
              <div className={styles.inputShell}>
                <FunnelIcon size={18} />
                <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as AppointmentFilters["status"])}>
                  <option value="ALL">{naming.t("appointments.statusAll")}</option>
                  <option value="OPEN">{naming.t("appointments.statusOpen")}</option>
                  <option value="FINISHED">{naming.t("appointments.statusFinished")}</option>
                  <option value="CANCELED">{naming.t("appointments.statusCanceled")}</option>
                </select>
              </div>
            </label>
          </div>
        </article>

        <article className={`${styles.card} ${styles.listCard}`}>
          <div className={styles.cardHeader}>
            <div>
              <h2>{naming.t("appointments.listTitle")}</h2>
              <p>{naming.t("appointments.listDescription")}</p>
            </div>
            <span className={styles.badge}>{appointmentsPage.totalElements} {naming.t("appointments.resultsCount")}</span>
          </div>

          {loading ? (
            <div className={styles.stateBox}>{naming.getMessage("loading")}</div>
          ) : listUnavailable ? (
            <div className={styles.stateBox}>
              <WarningCircleIcon size={24} />
              <div>
                <strong>{naming.t("appointments.listUnavailableTitle")}</strong>
                <p>{naming.t("appointments.listUnavailableDescription")}</p>
              </div>
            </div>
          ) : appointmentsPage.content.length === 0 ? (
            <div className={styles.stateBox}>
              <WarningCircleIcon size={24} />
              <div>
                <strong>{naming.t("appointments.emptyTitle")}</strong>
                <p>{naming.t("appointments.emptyDescription")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{naming.t("home.appointmentId")}</th>
                      <th>{naming.t("appointments.petColumn")}</th>
                      <th>{naming.t("appointments.typeColumn")}</th>
                      <th>{naming.t("appointments.dateColumn")}</th>
                      <th>{naming.t("appointments.serviceColumn")}</th>
                      <th>{naming.t("appointments.statusFilter")}</th>
                      <th>{naming.t("appointments.actionsColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentsPage.content.map((appointment) => {
                      const pet = petDirectory[appointment.petId];

                      return (
                        <tr key={appointment.id}>
                          <td>
                            <strong>#{appointment.id}</strong>
                            <span>{pet?.species || `${naming.t("home.pet")} #${appointment.petId}`}</span>
                          </td>
                          <td>
                            <strong>{pet?.name || `${naming.t("home.pet")} #${appointment.petId}`}</strong>
                            <span>{pet?.tutorName || `${naming.t("home.tutor")} #${pet?.tutorId ?? "—"}`}</span>
                          </td>
                          <td>
                            <strong>{getAppointmentTypeLabel(naming, appointment.appointmentType)}</strong>
                            <span>{appointment.veterinarianUserId ? `Vet #${appointment.veterinarianUserId}` : "—"}</span>
                          </td>
                          <td>
                            <strong>{formatDateTime(appointment.scheduledStartAt)}</strong>
                            <span>{formatDateTime(appointment.scheduledEndAt)}</span>
                          </td>
                          <td>
                            <strong>
                              {appointment.serviceProductId ? naming.t("appointments.serviceLinked") : naming.t("appointments.serviceMissing")}
                            </strong>
                            <span>{appointment.serviceProductId ? `#${appointment.serviceProductId}` : "—"}</span>
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${getAppointmentStatusTone(appointment.status)}`}>
                              {getAppointmentStatusLabel(naming, appointment.status)}
                            </span>
                          </td>
                          <td>
                            <button className={styles.iconButton} type="button" onClick={() => handleOpenDetails(appointment)}>
                              <EyeIcon size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={page === 0}
                >
                  {naming.t("sales.previousPage")}
                </button>

                <div className={styles.paginationNumbers}>
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={pageNumber === page ? styles.pageButtonActive : styles.pageButton}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber + 1}
                    </button>
                  ))}
                </div>

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setPage((current) => Math.min(current + 1, Math.max(appointmentsPage.totalPages - 1, 0)))}
                  disabled={page >= appointmentsPage.totalPages - 1}
                >
                  {naming.t("sales.nextPage")}
                </button>
              </div>
            </>
          )}
        </article>
      </section>

      {selectedAppointment ? (
        <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && handleCloseDetails()}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.kicker}>{naming.t("appointments.detailTitle")}</div>
                <h2>#{selectedAppointment.id}</h2>
                <p>{naming.t("appointments.detailDescription")}</p>
              </div>
              <button className={styles.iconButton} type="button" onClick={handleCloseDetails}>
                <XCircleIcon size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.summaryGrid}>
                <div className={styles.metricCard}>
                  <span>{naming.t("appointments.typeFilter")}</span>
                  <strong>{getAppointmentTypeLabel(naming, selectedAppointment.appointmentType)}</strong>
                </div>
                <div className={styles.metricCard}>
                  <span>{naming.t("appointments.statusFilter")}</span>
                  <strong>{getAppointmentStatusLabel(naming, selectedAppointment.status)}</strong>
                </div>
                <div className={styles.metricCard}>
                  <span>{naming.t("home.pet")}</span>
                  <strong>{petDirectory[selectedAppointment.petId]?.name || `#${selectedAppointment.petId}`}</strong>
                </div>
                <div className={styles.metricCard}>
                  <span>{naming.t("home.tutor")}</span>
                  <strong>{petDirectory[selectedAppointment.petId]?.tutorName || "—"}</strong>
                </div>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>
                    <CalendarBlankIcon size={16} />
                    <span>{naming.t("home.appointmentSchedule")}</span>
                  </div>
                  <strong>{formatDateTime(selectedAppointment.scheduledStartAt)}</strong>
                  <small>{formatDateTime(selectedAppointment.scheduledEndAt)}</small>
                </div>

                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>
                    <ClockCountdownIcon size={16} />
                    <span>{naming.t("appointments.openedAt")}</span>
                  </div>
                  <strong>{formatDateTime(selectedAppointment.openedAt)}</strong>
                  <small>{naming.t("appointments.updatedAt")}: {formatDateTime(selectedAppointment.updatedAt)}</small>
                </div>

                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>
                    <PawPrintIcon size={16} />
                    <span>{naming.t("appointments.serviceColumn")}</span>
                  </div>
                  <strong>
                    {selectedAppointment.serviceProductId ? naming.t("appointments.serviceLinked") : naming.t("appointments.serviceMissing")}
                  </strong>
                  <small>{selectedAppointment.serviceProductId ? `#${selectedAppointment.serviceProductId}` : "—"}</small>
                </div>

                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>
                    <UserCircleIcon size={16} />
                    <span>{naming.t("appointments.professional")}</span>
                  </div>
                  <strong>{selectedAppointment.veterinarianUserId ? `#${selectedAppointment.veterinarianUserId}` : "—"}</strong>
                  <small>{selectedAppointment.finishedBy ? `Finalizado por #${selectedAppointment.finishedBy}` : " "}</small>
                </div>
              </div>

              <div className={styles.notesPanel}>
                <div className={styles.sectionHeader}>
                  <h3>{naming.t("payment.notes")}</h3>
                  <span className={styles.badge}>{selectedAppointment.status}</span>
                </div>
                <p>{selectedAppointment.notes?.trim() || naming.t("appointments.noNotes")}</p>
              </div>

              {selectedAppointment.status === "FINISHED" || selectedAppointment.status === "CANCELED" ? (
                <div className={styles.timelineGrid}>
                  <div className={styles.timelineCard}>
                    <span>{naming.t("appointments.finishedAt")}</span>
                    <strong>{formatDateTime(selectedAppointment.finishedAt)}</strong>
                  </div>
                  <div className={styles.timelineCard}>
                    <span>{naming.t("appointments.canceledAt")}</span>
                    <strong>{formatDateTime(selectedAppointment.canceledAt)}</strong>
                  </div>
                  <div className={styles.timelineCard}>
                    <span>{naming.t("appointments.cancelReason")}</span>
                    <strong>{selectedAppointment.cancelReason?.trim() || "—"}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
