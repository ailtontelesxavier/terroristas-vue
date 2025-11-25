<script setup>
import axios from "axios";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const API_URL = "/api/onu";
const itemsPerPage = 20;

const sanctions = ref([]);
const loading = ref(false);
const verifying = ref(false);
const error = ref("");
const lastUpdated = ref("");
const searchTerm = ref("");
const page = ref(1);
const csvClients = ref([]);
const csvMatches = ref([]);
const csvFileName = ref("");
const csvStatus = ref("");
const now = ref(new Date());
let clockInterval;

const normalize = (value) =>
  (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const matchPersonWithTerm = (person, term) => {
  if (!term) return true;
  const aliases = (person.aliases || []).map((a) => a.name);
  const nameParts = [
    person.first_name,
    person.second_name,
    person.third_name,
    ...aliases,
  ]
    .filter(Boolean)
    .map(normalize);
  return nameParts.some((name) => name.includes(term));
};

const filteredIndividuals = computed(() => {
  const term = normalize(searchTerm.value);
  return sanctions.value.filter((person) => matchPersonWithTerm(person, term));
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredIndividuals.value.length / itemsPerPage))
);

const paginatedIndividuals = computed(() => {
  const start = (page.value - 1) * itemsPerPage;
  return filteredIndividuals.value.slice(start, start + itemsPerPage);
});

const formattedLastUpdated = computed(() => {
  if (!lastUpdated.value) return "Não disponível";
  const parsed = new Date(lastUpdated.value);
  if (Number.isNaN(parsed.getTime())) return lastUpdated.value;
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const formattedNow = computed(() =>
  now.value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
);

const goToPage = (target) => {
  const next = Math.min(Math.max(target, 1), totalPages.value);
  page.value = next;
};

const extractListUpdateDate = (xmlDoc, response) => {
  const candidates = [
    xmlDoc.querySelector("LAST_UPDATED"),
    xmlDoc.querySelector("LIST_LAST_UPDATE"),
    xmlDoc.querySelector("DATE_GENERATED"),
  ];
  const textValue =
    candidates.map((node) => node?.textContent?.trim()).find(Boolean) || "";
  if (textValue) return textValue;
  const headerDate =
    response?.headers?.["last-modified"] || response?.headers?.["Last-Modified"];
  if (headerDate) return headerDate;
  return new Date().toISOString();
};

const parseIndividual = (node) => {
  const value = (selector) =>
    node.querySelector(selector)?.textContent?.trim() || "";
  const list = (selector) =>
    Array.from(node.querySelectorAll(selector))
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
  const aliases = Array.from(node.querySelectorAll("INDIVIDUAL_ALIAS"))
    .map((alias) => ({
      quality: alias.querySelector("QUALITY")?.textContent?.trim() || "",
      name: alias.querySelector("ALIAS_NAME")?.textContent?.trim() || "",
    }))
    .filter((alias) => alias.name);

  return {
    id: value("DATAID"),
    first_name: value("FIRST_NAME"),
    second_name: value("SECOND_NAME"),
    third_name: value("THIRD_NAME"),
    list_type: value("UN_LIST_TYPE"),
    reference_number: value("REFERENCE_NUMBER"),
    listed_on: value("LISTED_ON"),
    comments: value("COMMENTS1"),
    nationalities: list("NATIONALITY > VALUE"),
    aliases,
    titles: list("TITLE > VALUE"),
    designations: list("DESIGNATION > VALUE"),
    birth_date: value("INDIVIDUAL_DATE_OF_BIRTH > YEAR"),
    birth_place: {
      city: value("INDIVIDUAL_PLACE_OF_BIRTH > CITY"),
      province: value("INDIVIDUAL_PLACE_OF_BIRTH > STATE_PROVINCE"),
      country: value("INDIVIDUAL_PLACE_OF_BIRTH > COUNTRY"),
    },
  };
};

const fetchOnuList = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await axios.get(API_URL, { responseType: "text" });
    if (!response.data) throw new Error("Falha ao carregar a lista da ONU.");
    const xmlText = response.data;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const individuals = Array.from(xmlDoc.querySelectorAll("INDIVIDUAL")).map(
      parseIndividual
    );
    sanctions.value = individuals;
    lastUpdated.value = extractListUpdateDate(xmlDoc, response);
    page.value = 1;
  } catch (err) {
    error.value = err?.message || "Erro inesperado ao buscar a lista.";
  } finally {
    loading.value = false;
  }
};

const parseCsvNames = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map((line) =>
    line
      .split(delimiter)
      .map((cell) => cell.replace(/^"|"$/g, "").trim())
      .filter((cell) => cell.length)
  );
  const content = rows[0]?.[0]?.toLowerCase() || "";
  const startIndex = content.includes("nome") || content.includes("name") ? 1 : 0;
  return rows.slice(startIndex).map((row) => row[0]).filter(Boolean);
};

const handleCsvUpload = (event) => {
  const [file] = event.target.files || [];
  csvMatches.value = [];
  csvStatus.value = "";
  if (!file) return;
  csvFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    csvClients.value = parseCsvNames(String(reader.result || ""));
    if (!csvClients.value.length) {
      csvStatus.value = "Nenhum nome encontrado no CSV enviado.";
    }
  };
  reader.readAsText(file, "utf-8");
};

const verifyCsvAgainstList = () => {
  csvMatches.value = [];
  csvStatus.value = "";
  if (!csvClients.value.length) {
    csvStatus.value = "Envie um CSV com nomes antes de verificar.";
    return;
  }
  verifying.value = true;
  const matches = csvClients.value
    .map((clientName) => {
      const norm = normalize(clientName);
      const hits = sanctions.value.filter((person) =>
        matchPersonWithTerm(person, norm)
      );
      return { clientName, hits };
    })
    .filter((entry) => entry.hits.length);
  csvMatches.value = matches;
  csvStatus.value = matches.length
    ? "Clientes encontrados na lista da ONU."
    : "Nenhum cliente do CSV consta na lista da ONU.";
  verifying.value = false;
};

const handleSearchSubmit = () => {
  page.value = 1;
};

watch(searchTerm, () => {
  page.value = 1;
});

onMounted(() => {
  fetchOnuList();
  clockInterval = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (clockInterval) {
    window.clearInterval(clockInterval);
  }
});
</script>

<template>
  <main>
    <h1 class="section-title">Consulta indivíduos sancionados da ONU</h1>

    <section class="card" style="margin-bottom: 18px">
      <div class="controls-row" style="justify-content: space-between">
        <div class="status">
          <span class="dot"></span>
          <span>Última atualização: {{ formattedLastUpdated }}</span>
        </div>
        <div class="muted small-label">
          Total de indivíduos carregados: {{ sanctions.length || "..." }}
        </div>
      </div>

      <div style="margin: 16px 0; border-top: 1px solid #e5e7eb"></div>

      <div class="controls-row">
        <div style="flex: 1; min-width: 200px">
          <label class="small-label" for="csvInput">
            Enviar (upload) de Planilha CSV
          </label>
          <input
            id="csvInput"
            class="input"
            type="file"
            accept=".csv,text/csv"
            @change="handleCsvUpload"
          />
          <div class="small-label muted" style="margin-top: 6px">
            {{ csvFileName || "Nenhum arquivo selecionado" }}
          </div>
        </div>
        <div class="controls-row" style="gap: 8px">
          <button
            class="button primary"
            :disabled="loading"
            @click="fetchOnuList"
          >
            {{ loading ? "Atualizando..." : "Atualizar lista ONU" }}
          </button>
          <button
            class="button secondary"
            :disabled="loading || verifying || !sanctions.length"
            @click="verifyCsvAgainstList"
          >
            {{ verifying ? "Verificando..." : "Verificar Clientes Cadastrados" }}
          </button>
        </div>
      </div>

      <div style="margin: 16px 0; border-top: 1px solid #e5e7eb"></div>

      <div class="list-row">
        <div>
          <label class="small-label" for="search">Procurar Pessoas</label>
          <div class="controls-row">
            <input
              id="search"
              class="input"
              type="text"
              placeholder="Pesquisar por nome"
              v-model="searchTerm"
              @keyup.enter="handleSearchSubmit"
            />
            <button class="button primary" @click="handleSearchSubmit">
              Consultar
            </button>
            <div
              class="small-label muted"
              style="white-space: nowrap; min-width: 180px; text-align: right"
            >
              Agora: {{ formattedNow }}
            </div>
          </div>
        </div>

        <div class="card" style="background: #f8fafc; border-color: #e5e7eb">
          <div class="small-label muted">Resultado do CSV</div>
          <div v-if="csvMatches.length">
            <div
              v-for="item in csvMatches"
              :key="item.clientName"
              style="margin-bottom: 10px"
            >
              <div class="pill">{{ item.clientName }}</div>
              <div class="pill-stack" style="margin-top: 6px">
                <span
                  v-for="hit in item.hits"
                  :key="hit.id"
                  class="badge"
                  title="Nome encontrado na lista da ONU"
                >
                  {{ hit.first_name }} {{ hit.second_name }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="muted">
            {{ csvStatus || "Nenhum cliente verificado até o momento." }}
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="controls-row" style="justify-content: space-between">
        <h2 class="section-title" style="margin: 0">Lista de Pessoas</h2>
        <span class="badge">
          Página {{ page }} de {{ totalPages }}
        </span>
      </div>

      <div v-if="error" class="alert" style="margin-top: 10px">{{ error }}</div>
      <div v-else-if="loading" style="margin-top: 10px" class="muted">
        Carregando lista da ONU...
      </div>

      <table v-if="!loading && paginatedIndividuals.length" class="table">
        <thead>
          <tr>
            <th style="width: 30%">First Name</th>
            <th style="width: 30%">Second Name</th>
            <th style="width: 40%">Designações / Aliases</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="person in paginatedIndividuals" :key="person.id">
            <td>{{ person.first_name || "-" }}</td>
            <td>{{ person.second_name || "-" }}</td>
            <td>
              <div class="pill-stack">
                <span
                  v-for="(alias, index) in person.aliases"
                  :key="`${person.id}-${index}`"
                  class="pill"
                >
                  {{ alias.name }}
                </span>
                <span
                  v-for="(designation, index) in person.designations"
                  :key="`${person.id}-des-${index}`"
                  class="badge"
                >
                  {{ designation }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !paginatedIndividuals.length" class="muted">
        Nenhuma pessoa encontrada para o filtro informado.
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="page === 1" @click="goToPage(page - 1)">
          Anterior
        </button>
        <button
          v-for="p in totalPages"
          :key="p"
          :class="{ active: p === page }"
          @click="goToPage(p)"
        >
          {{ p }}
        </button>
        <button :disabled="page === totalPages" @click="goToPage(page + 1)">
          Próximo
        </button>
      </div>
    </section>
  </main>
</template>
