(function () {
  "use strict";

  const APP_STORAGE_KEY = "app_data_v1";
  const APP_SCHEMA_VERSION = 1;

  function nowIso() {
    return new Date().toISOString();
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function uid(prefix = "id") {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function normalizeString(value, fallback = "") {
    return typeof value === "string" ? value.trim() : fallback;
  }

  function normalizeBoolean(value) {
    return value === true;
  }

  function normalizeArray(value, fallback = []) {
    return Array.isArray(value) ? value : fallback;
  }

  function slugify(value) {
    return normalizeString(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function createDefaultData() {
    const timestamp = nowIso();

    return {
      schemaVersion: APP_SCHEMA_VERSION,
      meta: {
        appName: "Mon App Perso",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      settings: {
        theme: "dark",
        language: "fr"
      },
      notes: [],
      categories: [
        {
          id: uid("cat"),
          name: "Travail",
          slug: "travail",
          system: true,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        {
          id: uid("cat"),
          name: "Perso",
          slug: "perso",
          system: true,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        {
          id: uid("cat"),
          name: "Autres",
          slug: "autres",
          system: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
    };
  }

  function normalizeChecklistItem(item) {
    if (!isPlainObject(item)) {
      const timestamp = nowIso();
      return {
        id: uid("item"),
        text: "",
        done: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    }

    const text = normalizeString(item.text);
    const createdAt = normalizeString(item.createdAt, nowIso());
    const updatedAt = normalizeString(item.updatedAt, createdAt);

    return {
      id: normalizeString(item.id, uid("item")),
      text,
      done: normalizeBoolean(item.done),
      createdAt,
      updatedAt
    };
  }

  function normalizeCategory(category) {
    if (!isPlainObject(category)) {
      const name = normalizeString(category, "Sans catégorie");
      const timestamp = nowIso();

      return {
        id: uid("cat"),
        name,
        slug: slugify(name) || uid("slug"),
        system: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    }

    const name = normalizeString(category.name, "Sans catégorie");
    const createdAt = normalizeString(category.createdAt, nowIso());
    const updatedAt = normalizeString(category.updatedAt, createdAt);

    return {
      id: normalizeString(category.id, uid("cat")),
      name,
      slug: normalizeString(category.slug, slugify(name) || uid("slug")),
      system: normalizeBoolean(category.system),
      createdAt,
      updatedAt
    };
  }

  function normalizeNote(note, categories) {
    const fallbackCategoryName = categories[0]?.name || "Autres";

    if (!isPlainObject(note)) {
      const timestamp = nowIso();
      return {
        id: uid("note"),
        type: "note",
        title: "",
        content: "",
        category: fallbackCategoryName,
        favorite: false,
        pinned: false,
        archived: false,
        tags: [],
        items: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
    }

    const type = note.type === "list" ? "list" : "note";
    const createdAt = normalizeString(note.createdAt, nowIso());
    const updatedAt = normalizeString(note.updatedAt, createdAt);

    return {
      id: normalizeString(note.id, uid("note")),
      type,
      title: normalizeString(note.title),
      content: normalizeString(note.content),
      category: normalizeString(note.category, fallbackCategoryName),
      favorite: normalizeBoolean(note.favorite),
      pinned: normalizeBoolean(note.pinned),
      archived: normalizeBoolean(note.archived),
      tags: normalizeArray(note.tags, [])
        .map(tag => normalizeString(tag))
        .filter(Boolean),
      items: normalizeArray(note.items, []).map(normalizeChecklistItem),
      createdAt,
      updatedAt
    };
  }

  function ensureSystemCategories(data) {
    const required = ["Travail", "Perso", "Autres"];
    const existingNames = new Set(data.categories.map(cat => cat.name.toLowerCase()));
    const timestamp = nowIso();

    required.forEach(name => {
      if (!existingNames.has(name.toLowerCase())) {
        data.categories.push({
          id: uid("cat"),
          name,
          slug: slugify(name),
          system: true,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    });

    return data;
  }

  function normalizeDataShape(data) {
    const base = createDefaultData();
    const source = isPlainObject(data) ? data : {};

    let categories = normalizeArray(source.categories, base.categories).map(normalizeCategory);

    if (!categories.length) {
      categories = deepClone(base.categories);
    }

    const normalized = {
      schemaVersion: Number.isInteger(source.schemaVersion)
        ? source.schemaVersion
        : APP_SCHEMA_VERSION,
      meta: {
        appName: normalizeString(source.meta?.appName, base.meta.appName),
        createdAt: normalizeString(source.meta?.createdAt, base.meta.createdAt),
        updatedAt: normalizeString(source.meta?.updatedAt, nowIso())
      },
      settings: {
        theme: normalizeString(source.settings?.theme, base.settings.theme),
        language: normalizeString(source.settings?.language, base.settings.language)
      },
      categories,
      notes: normalizeArray(source.notes, []).map(note => normalizeNote(note, categories))
    };

    return ensureSystemCategories(normalized);
  }

  function migrateData(rawData) {
    const data = normalizeDataShape(rawData);

    if (data.schemaVersion < 1) {
      data.schemaVersion = 1;
    }

    data.meta.updatedAt = nowIso();
    return data;
  }

  function validateImportedData(data) {
    if (!isPlainObject(data)) {
      throw new Error("Le fichier importé n'est pas un objet JSON valide.");
    }

    if (!Array.isArray(data.notes)) {
      throw new Error("Le fichier importé ne contient pas de tableau 'notes' valide.");
    }

    if (!Array.isArray(data.categories)) {
      throw new Error("Le fichier importé ne contient pas de tableau 'categories' valide.");
    }

    return true;
  }

  const LocalAdapter = {
    async load() {
      const raw = localStorage.getItem(APP_STORAGE_KEY);
      if (!raw) return createDefaultData();

      const parsed = safeJsonParse(raw, null);
      if (!parsed) return createDefaultData();

      return migrateData(parsed);
    },

    async save(data) {
      const normalized = migrateData(data);
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    },

    async clear() {
      localStorage.removeItem(APP_STORAGE_KEY);
      return true;
    }
  };

  const AppData = {
    adapter: LocalAdapter,

    async getData() {
      return deepClone(await this.adapter.load());
    },

    async saveData(data) {
      const prepared = migrateData(data);
      prepared.meta.updatedAt = nowIso();
      return this.adapter.save(prepared);
    },

    async resetData() {
      const fresh = createDefaultData();
      return this.saveData(fresh);
    },

    async exportData(filename = "mon-app-backup.json") {
      const data = await this.getData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 500);
    },

    async importDataFromFile(file, options = { mode: "replace" }) {
      if (!file) {
        throw new Error("Aucun fichier sélectionné.");
      }

      const text = await file.text();
      const parsed = safeJsonParse(text, null);

      if (!parsed) {
        throw new Error("Le fichier JSON est invalide.");
      }

      validateImportedData(parsed);

      const imported = migrateData(parsed);
      const mode = options?.mode === "merge" ? "merge" : "replace";

      if (mode === "merge") {
        const current = await this.getData();
        const merged = this.mergeData(current, imported);
        return this.saveData(merged);
      }

      return this.saveData(imported);
    },

    mergeData(current, incoming) {
      const currentData = migrateData(current);
      const incomingData = migrateData(incoming);

      const categoryMap = new Map();

      currentData.categories.forEach(cat => {
        categoryMap.set(cat.name.toLowerCase(), cat);
      });

      incomingData.categories.forEach(cat => {
        const key = cat.name.toLowerCase();
        if (!categoryMap.has(key)) {
          categoryMap.set(key, cat);
        }
      });

      const mergedCategories = Array.from(categoryMap.values());

      const noteMap = new Map();

      currentData.notes.forEach(note => {
        noteMap.set(note.id, note);
      });

      incomingData.notes.forEach(note => {
        if (!noteMap.has(note.id)) {
          noteMap.set(note.id, note);
          return;
        }

        const existing = noteMap.get(note.id);
        const existingTime = new Date(existing.updatedAt).getTime() || 0;
        const incomingTime = new Date(note.updatedAt).getTime() || 0;

        if (incomingTime >= existingTime) {
          noteMap.set(note.id, note);
        }
      });

      return migrateData({
        ...currentData,
        categories: mergedCategories,
        notes: Array.from(noteMap.values())
      });
    },

    async getNotes() {
      const data = await this.getData();
      return deepClone(data.notes);
    },

    async getNoteById(noteId) {
      const data = await this.getData();
      const note = data.notes.find(note => note.id === noteId);
      return note ? deepClone(note) : null;
    },

    async getCategories() {
      const data = await this.getData();
      return deepClone(data.categories);
    },

    async getCategoryNames() {
      const categories = await this.getCategories();
      return categories.map(cat => cat.name);
    },

    async addCategory(name) {
      const cleanName = normalizeString(name);
      if (!cleanName) {
        throw new Error("Le nom de la catégorie est vide.");
      }

      const data = await this.getData();
      const exists = data.categories.some(
        cat => cat.name.toLowerCase() === cleanName.toLowerCase()
      );

      if (exists) {
        throw new Error("Cette catégorie existe déjà.");
      }

      const timestamp = nowIso();
      const category = {
        id: uid("cat"),
        name: cleanName,
        slug: slugify(cleanName) || uid("slug"),
        system: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      data.categories.push(category);
      await this.saveData(data);
      return category;
    },

    async saveNote(noteInput) {
      const data = await this.getData();
      const categories = data.categories;
      const normalized = normalizeNote(noteInput, categories);

      if (!normalized.title) {
        throw new Error("Le titre est requis.");
      }

      if (!normalized.category) {
        throw new Error("La catégorie est requise.");
      }

      const categoryExists = categories.some(
        cat => cat.name.toLowerCase() === normalized.category.toLowerCase()
      );

      if (!categoryExists) {
        const timestamp = nowIso();
        data.categories.push({
          id: uid("cat"),
          name: normalized.category,
          slug: slugify(normalized.category) || uid("slug"),
          system: false,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      const existingIndex = data.notes.findIndex(note => note.id === normalized.id);

      if (existingIndex >= 0) {
        normalized.createdAt = data.notes[existingIndex].createdAt;
        normalized.updatedAt = nowIso();
        data.notes[existingIndex] = normalized;
      } else {
        normalized.createdAt = normalized.createdAt || nowIso();
        normalized.updatedAt = nowIso();
        data.notes.push(normalized);
      }

      await this.saveData(data);
      return normalized;
    },

    async deleteNote(noteId) {
      const data = await this.getData();
      const before = data.notes.length;
      data.notes = data.notes.filter(note => note.id !== noteId);

      if (data.notes.length === before) {
        return false;
      }

      await this.saveData(data);
      return true;
    },

    async toggleFavorite(noteId) {
      const data = await this.getData();
      const note = data.notes.find(n => n.id === noteId);
      if (!note) throw new Error("Note introuvable.");

      note.favorite = !note.favorite;
      note.updatedAt = nowIso();

      await this.saveData(data);
      return note;
    },

    async togglePinned(noteId) {
      const data = await this.getData();
      const note = data.notes.find(n => n.id === noteId);
      if (!note) throw new Error("Note introuvable.");

      note.pinned = !note.pinned;
      note.updatedAt = nowIso();

      await this.saveData(data);
      return note;
    },

    async toggleChecklistItem(noteId, itemId) {
      const data = await this.getData();
      const note = data.notes.find(n => n.id === noteId);
      if (!note) throw new Error("Note introuvable.");
      if (note.type !== "list") throw new Error("Cette note n'est pas une liste.");

      const item = note.items.find(i => i.id === itemId);
      if (!item) throw new Error("Item introuvable.");

      item.done = !item.done;
      item.updatedAt = nowIso();
      note.updatedAt = nowIso();

      await this.saveData(data);
      return item;
    },

    async archiveNote(noteId, archived = true) {
      const data = await this.getData();
      const note = data.notes.find(n => n.id === noteId);
      if (!note) throw new Error("Note introuvable.");

      note.archived = archived;
      note.updatedAt = nowIso();

      await this.saveData(data);
      return note;
    },

    async searchNotes(filters = {}) {
      const data = await this.getData();

      const keyword = normalizeString(filters.keyword).toLowerCase();
      const category = normalizeString(filters.category, "all");
      const type = normalizeString(filters.type, "all");
      const favoritesOnly = filters.favoritesOnly === true;
      const pinnedFirst = filters.pinnedFirst !== false;
      const includeArchived = filters.includeArchived === true;

      let result = data.notes.filter(note => {
        if (!includeArchived && note.archived) return false;
        if (category !== "all" && note.category !== category) return false;
        if (type !== "all" && note.type !== type) return false;
        if (favoritesOnly && !note.favorite) return false;

        if (!keyword) return true;

        const inTitle = note.title.toLowerCase().includes(keyword);
        const inContent = note.content.toLowerCase().includes(keyword);
        const inCategory = note.category.toLowerCase().includes(keyword);
        const inTags = note.tags.some(tag => tag.toLowerCase().includes(keyword));
        const inItems = note.items.some(item => item.text.toLowerCase().includes(keyword));

        return inTitle || inContent || inCategory || inTags || inItems;
      });

      result.sort((a, b) => {
        if (pinnedFirst && a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        const aTime = new Date(a.updatedAt).getTime() || 0;
        const bTime = new Date(b.updatedAt).getTime() || 0;
        return bTime - aTime;
      });

      return deepClone(result);
    },

    createEmptyNote(type = "note", category = "Travail") {
      const timestamp = nowIso();
      return {
        id: uid("note"),
        type: type === "list" ? "list" : "note",
        title: "",
        content: "",
        category,
        favorite: false,
        pinned: false,
        archived: false,
        tags: [],
        items: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
    }
  };

  window.AppData = Object.freeze(AppData);
})();
