/**
 * RunMyWay - Application de génération de parcours
 */

class RunMyWayApp {
    constructor() {
        this.map = null;
        this.markers = [];
        this.routePolyline = null;
        this.startPoint = null;
        this.endPoint = null;
        this.pois = [];
        
        // Configuration POI
        this.poiCategories = [
            { id: 'parc', name: 'Parcs et jardins', icon: '🌳', queries: ['parc', 'jardin public'] },
            { id: 'monument', name: 'Monuments', icon: '🏛️', queries: ['monument', 'château'] },
            { id: 'eau', name: 'Points d\'eau', icon: '💧', queries: ['lac', 'rivière'] },
            { id: 'culture', name: 'Lieux culturels', icon: '🎭', queries: ['musée', 'théâtre'] }
        ];
    }

    async init() {
        console.log('🚀 Initialisation de RunMyWay...');
        
        try {
            this.initializeMap();
            this.setupEventListeners();
            this.setupAutocomplete();
            this.setupUI();
            
            console.log('✅ RunMyWay initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            this.showError('Erreur lors de l\'initialisation de l\'application');
        }
    }

    initializeMap() {
        if (typeof L === 'undefined') {
            throw new Error('Leaflet n\'est pas chargé');
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            throw new Error('Conteneur de carte non trouvé');
        }

        // Créer la carte
        this.map = L.map('map').setView([48.8566, 2.3522], 12);
        
        // Ajouter les tuiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Événements de carte
        this.map.on('click', (e) => this.handleMapClick(e));
        
        console.log('🗺️ Carte initialisée');
    }

    setupEventListeners() {
        // Bouton générer
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateRoute());
        }

        // Bouton reset
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        // Bouton export
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportGPX());
        }

        // Bouton position
        const useLocationBtn = document.getElementById('useLocationBtn');
        if (useLocationBtn) {
            useLocationBtn.addEventListener('click', () => this.useCurrentLocation());
        }

        // Slider distance
        const distanceSlider = document.getElementById('targetDistance');
        const distanceValue = document.getElementById('distanceValue');
        if (distanceSlider && distanceValue) {
            distanceSlider.addEventListener('input', (e) => {
                distanceValue.textContent = e.target.value + ' km';
            });
        }

        // Gestion POI
        const addPOIBtn = document.getElementById('addPOIBtn');
        if (addPOIBtn) {
            addPOIBtn.addEventListener('click', () => this.addCustomPOI());
        }

        const poiInput = document.getElementById('poiInput');
        if (poiInput) {
            poiInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addCustomPOI();
                }
            });
            this.setupPOIAutocomplete(poiInput);
        }

        // Gestion des onglets POI
        const poiTabs = document.querySelectorAll('.poi-tab');
        poiTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchPOITab(tabName);
            });
        });

        // Gestion des presets POI
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.dataset.preset;
                this.togglePOIPreset(preset, e.currentTarget);
            });
        });

        console.log('🔗 Événements configurés');
    }

    /**
     * Setup autocomplete for address and POI inputs
     */
    setupAutocomplete() {
        const startAddressInput = document.getElementById('startAddress');
        const endAddressInput = document.getElementById('endAddress');
        
        if (startAddressInput) {
            this.setupAddressAutocomplete(startAddressInput, 'startAddressSuggestions', 'start');
        }
        
        if (endAddressInput) {
            this.setupAddressAutocomplete(endAddressInput, 'endAddressSuggestions', 'end');
        }
        
        console.log('🔍 Autocomplete setup complete');
    }

    /**
     * Configure l'autocomplétion pour un champ d'adresse
     */
    setupAddressAutocomplete(input, suggestionsId, type) {
        const suggestionsContainer = document.getElementById(suggestionsId);
        let searchTimeout;
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Effacer le timeout précédent
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // Masquer les suggestions si la requête est trop courte
            if (query.length < 3) {
                this.hideSuggestions(suggestionsContainer);
                return;
            }
            
            // Délai pour éviter trop de requêtes
            searchTimeout = setTimeout(async () => {
                try {
                    const suggestions = await this.searchAddresses(query);
                    this.showAddressSuggestions(suggestions, suggestionsContainer, input, type);
                } catch (error) {
                    console.error('Erreur de recherche d\'adresses:', error);
                    this.hideSuggestions(suggestionsContainer);
                }
            }, 300);
        });
        
        // Masquer les suggestions quand on clique ailleurs
        input.addEventListener('blur', () => {
            setTimeout(() => {
                this.hideSuggestions(suggestionsContainer);
            }, 200);
        });
        
        input.addEventListener('focus', () => {
            if (input.value.length >= 3 && suggestionsContainer.children.length > 0) {
                suggestionsContainer.style.display = 'block';
            }
        });
    }

    /**
     * Recherche d'adresses via l'API Nominatim
     */
    async searchAddresses(query) {
        const url = `https://nominatim.openstreetmap.org/search?` +
            `format=json&` +
            `q=${encodeURIComponent(query)}&` +
            `limit=5&` +
            `countrycodes=fr&` +
            `addressdetails=1`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'fr',
                    'User-Agent': 'RunMyWay/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.map(item => ({
                display_name: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lng),
                type: item.type,
                importance: item.importance || 0
            }));
        } catch (error) {
            console.error('Erreur API Nominatim:', error);
            return [];
        }
    }

    /**
     * Affiche les suggestions d'adresses
     */
    showAddressSuggestions(suggestions, container, input, type) {
        if (!container) return;
        
        container.innerHTML = '';
        container.style.display = 'none';
        
        if (suggestions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'suggestion-item';
            noResults.textContent = 'Aucune adresse trouvée';
            noResults.style.color = '#64748B';
            container.appendChild(noResults);
            container.style.display = 'block';
            return;
        }
        
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div style="font-weight: 500;">${this.formatAddressName(suggestion.display_name)}</div>
                <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.25rem;">
                    ${this.getAddressDetails(suggestion.display_name)}
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.selectAddress(suggestion, input, type);
                this.hideSuggestions(container);
            });
            
            container.appendChild(item);
        });
        
        container.style.display = 'block';
    }

    /**
     * Formate le nom d'une adresse pour l'affichage
     */
    formatAddressName(displayName) {
        const parts = displayName.split(',');
        return parts[0] + (parts[1] ? ', ' + parts[1] : '');
    }

    /**
     * Extrait les détails d'une adresse
     */
    getAddressDetails(displayName) {
        const parts = displayName.split(',');
        return parts.slice(2).join(',').trim();
    }

    /**
     * Sélectionne une adresse dans les suggestions
     */
    selectAddress(suggestion, input, type) {
        input.value = this.formatAddressName(suggestion.display_name);
        
        const latlng = L.latLng(suggestion.lat, suggestion.lng);
        
        if (type === 'start') {
            this.setStartPoint(latlng);
            // Centrer la carte sur l'adresse
            this.map.setView(latlng, 15);
        } else if (type === 'end') {
            this.setEndPoint(latlng);
            // Ajuster la vue pour voir les deux points
            if (this.startPoint) {
                const bounds = L.latLngBounds([this.startPoint, latlng]);
                this.map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                this.map.setView(latlng, 15);
            }
        }
        
        console.log(`✅ ${type === 'start' ? 'Départ' : 'Arrivée'} défini:`, suggestion.display_name);
    }

    /**
     * Masque les suggestions
     */
    hideSuggestions(container) {
        if (container) {
            container.style.display = 'none';
        }
    }

    /**
     * Configure l'autocomplétion pour les POI personnalisés
     */
    setupPOIAutocomplete(input) {
        const suggestionsContainer = document.getElementById('poiSuggestions');
        let searchTimeout;
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            if (query.length < 3) {
                this.hideSuggestions(suggestionsContainer);
                return;
            }
            
            searchTimeout = setTimeout(async () => {
                try {
                    // Rechercher autour du point de départ ou centre de la carte
                    const searchCenter = this.startPoint || this.map.getCenter();
                    const suggestions = await this.searchPOIs(query, searchCenter);
                    this.showPOISuggestions(suggestions, suggestionsContainer, input);
                } catch (error) {
                    console.error('Erreur de recherche POI:', error);
                    this.hideSuggestions(suggestionsContainer);
                }
            }, 300);
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => {
                this.hideSuggestions(suggestionsContainer);
            }, 200);
        });
    }

    /**
     * Recherche de POI via l'API Nominatim
     */
    async searchPOIs(query, centerPoint, radiusKm = 10) {
        const url = `https://nominatim.openstreetmap.org/search?` +
            `format=json&` +
            `q=${encodeURIComponent(query)}&` +
            `limit=8&` +
            `countrycodes=fr&` +
            `lat=${centerPoint.lat}&` +
            `lon=${centerPoint.lng}&` +
            `bounded=1&` +
            `viewbox=${centerPoint.lng - 0.1},${centerPoint.lat + 0.1},${centerPoint.lng + 0.1},${centerPoint.lat - 0.1}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'fr',
                    'User-Agent': 'RunMyWay/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.map(item => ({
                name: item.display_name.split(',')[0],
                full_name: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: item.type,
                class: item.class,
                importance: item.importance || 0
            })).filter(poi => {
                // Filtrer les types intéressants
                const interestingTypes = ['tourism', 'amenity', 'leisure', 'historic', 'natural'];
                return interestingTypes.includes(poi.class);
            });
        } catch (error) {
            console.error('Erreur API POI:', error);
            return [];
        }
    }

    /**
     * Affiche les suggestions de POI
     */
    showPOISuggestions(suggestions, container, input) {
        if (!container) return;
        
        container.innerHTML = '';
        container.style.display = 'none';
        
        if (suggestions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'suggestion-item';
            noResults.textContent = 'Aucun POI trouvé';
            noResults.style.color = '#64748B';
            container.appendChild(noResults);
            container.style.display = 'block';
            return;
        }
        
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div style="font-weight: 500;">${suggestion.name}</div>
                <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.25rem;">
                    ${this.getPOITypeIcon(suggestion.type)} ${this.formatPOIType(suggestion.type, suggestion.class)}
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.selectPOI(suggestion, input);
                this.hideSuggestions(container);
            });
            
            container.appendChild(item);
        });
        
        container.style.display = 'block';
    }

    /**
     * Obtient l'icône pour un type de POI
     */
    getPOITypeIcon(type) {
        const icons = {
            attraction: '🎯',
            museum: '🏛️',
            park: '🌳',
            restaurant: '🍽️',
            cafe: '☕',
            shop: '🛒',
            church: '⛪',
            monument: '🏛️',
            fountain: '⛲',
            garden: '🌺',
            default: '📍'
        };
        return icons[type] || icons.default;
    }

    /**
     * Formate le type de POI pour l'affichage
     */
    formatPOIType(type, poiClass) {
        const translations = {
            attraction: 'Attraction',
            museum: 'Musée',
            park: 'Parc',
            restaurant: 'Restaurant',
            cafe: 'Café',
            shop: 'Commerce',
            church: 'Église',
            monument: 'Monument',
            fountain: 'Fontaine',
            garden: 'Jardin',
            tourism: 'Tourisme',
            amenity: 'Service',
            leisure: 'Loisir',
            historic: 'Historique',
            natural: 'Nature'
        };
        return translations[type] || translations[poiClass] || type;
    }

    /**
     * Sélectionne un POI depuis les suggestions
     */
    selectPOI(poi, input) {
        input.value = poi.name;
        this.addPOIToList(poi);
    }

    /**
     * Ajoute un POI personnalisé
     */
    async addCustomPOI() {
        const poiInput = document.getElementById('poiInput');
        if (!poiInput) return;
        
        const query = poiInput.value.trim();
        if (query.length < 2) {
            this.showError('Veuillez saisir un nom de lieu');
            return;
        }
        
        try {
            // Rechercher le POI
            const searchCenter = this.startPoint || this.map.getCenter();
            const pois = await this.searchPOIs(query, searchCenter);
            
            if (pois.length > 0) {
                const poi = pois[0]; // Prendre le premier résultat
                this.addPOIToList(poi);
                poiInput.value = '';
            } else {
                // Créer un POI générique basé sur la recherche d'adresse
                const addresses = await this.searchAddresses(query);
                if (addresses.length > 0) {
                    const address = addresses[0];
                    const genericPOI = {
                        name: this.formatAddressName(address.display_name),
                        full_name: address.display_name,
                        lat: address.lat,
                        lng: address.lng,
                        type: 'custom',
                        class: 'custom'
                    };
                    this.addPOIToList(genericPOI);
                    poiInput.value = '';
                } else {
                    this.showError('Aucun lieu trouvé pour cette recherche');
                }
            }
        } catch (error) {
            console.error('Erreur ajout POI:', error);
            this.showError('Erreur lors de l\'ajout du POI');
        }
    }

    /**
     * Ajoute un POI à la liste des POI sélectionnés
     */
    addPOIToList(poi) {
        // Éviter les doublons
        const exists = this.pois.find(p => 
            Math.abs(p.lat - poi.lat) < 0.001 && Math.abs(p.lng - poi.lng) < 0.001
        );
        
        if (exists) {
            this.showError('Ce POI est déjà dans votre liste');
            return;
        }
        
        // Ajouter à la liste
        this.pois.push(poi);
        this.updatePOIChips();
        
        // Ajouter un marqueur temporaire sur la carte
        this.addPOIMarker(poi);
        
        console.log(`✅ POI ajouté: ${poi.name}`);
    }

    /**
     * Met à jour l'affichage des chips POI
     */
    updatePOIChips() {
        const chipsContainer = document.getElementById('poiChips');
        if (!chipsContainer) return;
        
        chipsContainer.innerHTML = '';
        
        this.pois.forEach((poi, index) => {
            const chip = document.createElement('div');
            chip.className = 'poi-chip';
            chip.innerHTML = `
                <span>${this.getPOITypeIcon(poi.type)} ${poi.name}</span>
                <button onclick="window.runMyWayApp.removePOI(${index})" title="Supprimer">×</button>
            `;
            chipsContainer.appendChild(chip);
        });
    }

    /**
     * Supprime un POI de la liste
     */
    removePOI(index) {
        if (index >= 0 && index < this.pois.length) {
            const poi = this.pois[index];
            this.pois.splice(index, 1);
            this.updatePOIChips();
            this.removePOIMarker(poi);
            console.log(`🗑️ POI supprimé: ${poi.name}`);
        }
    }

    /**
     * Ajoute un marqueur POI sur la carte
     */
    addPOIMarker(poi) {
        const marker = L.circleMarker([poi.lat, poi.lng], {
            radius: 8,
            fillColor: '#F59E0B',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);
        
        marker.bindPopup(`<strong>${poi.name}</strong><br>${this.formatPOIType(poi.type, poi.class)}`);
        
        // Stocker la référence du marqueur avec le POI
        poi._marker = marker;
    }

    /**
     * Supprime un marqueur POI de la carte
     */
    removePOIMarker(poi) {
        if (poi._marker) {
            this.map.removeLayer(poi._marker);
            delete poi._marker;
        }
    }

    /**
     * Gestion des onglets POI
     */
    switchPOITab(tabName) {
        // Mettre à jour les onglets
        document.querySelectorAll('.poi-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.poi-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Activer l'onglet sélectionné
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    /**
     * Active/désactive un preset POI
     */
    async togglePOIPreset(presetType, buttonElement) {
        const isActive = buttonElement.classList.contains('active');
        
        if (isActive) {
            // Désactiver le preset
            buttonElement.classList.remove('active');
            this.removePOIsByCategory(presetType);
        } else {
            // Activer le preset
            buttonElement.classList.add('active');
            await this.addPOIsByCategory(presetType);
        }
    }

    /**
     * Ajoute automatiquement des POI selon une catégorie
     */
    async addPOIsByCategory(category) {
        if (!this.startPoint) {
            this.showError('Veuillez d\'abord définir un point de départ');
            return;
        }

        try {
            const queries = this.getCategoryQueries(category);
            const searchCenter = this.startPoint;
            const maxPOIs = 3; // Limiter à 3 POI par catégorie
            
            console.log(`🔍 Recherche POI catégorie: ${category}`);
            
            for (const query of queries) {
                const pois = await this.searchPOIs(query, searchCenter);
                
                // Ajouter les meilleurs POI de cette recherche
                const filteredPOIs = pois
                    .filter(poi => !this.pois.some(existing => 
                        Math.abs(existing.lat - poi.lat) < 0.001 && 
                        Math.abs(existing.lng - poi.lng) < 0.001
                    ))
                    .slice(0, Math.max(1, Math.floor(maxPOIs / queries.length)));
                
                for (const poi of filteredPOIs) {
                    poi.category = category; // Marquer la catégorie
                    this.addPOIToList(poi);
                }
                
                // Délai pour éviter de surcharger l'API
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            if (this.pois.filter(p => p.category === category).length === 0) {
                this.showError(`Aucun POI ${this.getCategoryName(category)} trouvé dans cette zone`);
            } else {
                console.log(`✅ POI ${category} ajoutés`);
            }
            
        } catch (error) {
            console.error(`Erreur ajout POI ${category}:`, error);
            this.showError(`Erreur lors de la recherche de POI ${this.getCategoryName(category)}`);
        }
    }

    /**
     * Supprime les POI d'une catégorie
     */
    removePOIsByCategory(category) {
        const poisToRemove = this.pois.filter(poi => poi.category === category);
        
        poisToRemove.forEach(poi => {
            const index = this.pois.indexOf(poi);
            if (index > -1) {
                this.removePOI(index);
            }
        });
        
        console.log(`🗑️ POI ${category} supprimés`);
    }

    /**
     * Obtient les requêtes de recherche pour une catégorie
     */
    getCategoryQueries(category) {
        const queries = {
            nature: ['parc', 'jardin public', 'forêt', 'lac'],
            culture: ['musée', 'monument', 'église', 'théâtre'],
            sport: ['stade', 'piscine', 'gymnase', 'terrain de sport'],
            panorama: ['belvédère', 'point de vue', 'tour', 'colline'],
            eau: ['fontaine', 'lac', 'rivière', 'canal'],
            shopping: ['marché', 'centre commercial', 'rue commerçante']
        };
        
        return queries[category] || [category];
    }

    /**
     * Obtient le nom d'affichage d'une catégorie
     */
    getCategoryName(category) {
        const names = {
            nature: 'Nature',
            culture: 'Culture', 
            sport: 'Sport',
            panorama: 'Panorama',
            eau: 'Points d\'eau',
            shopping: 'Shopping'
        };
        
        return names[category] || category;
    }

    setupUI() {
        // Configuration basique de l'interface
        this.updateDistanceSlider();
        console.log('🎨 Interface configurée');
    }

    updateDistanceSlider() {
        const modeInputs = document.querySelectorAll('input[name="travelMode"]');
        const distanceSlider = document.getElementById('targetDistance');
        const maxLabel = document.getElementById('maxLabel');

        if (modeInputs && distanceSlider && maxLabel) {
            modeInputs.forEach(input => {
                input.addEventListener('change', () => {
                    const mode = input.value;
                    let maxDistance = 10;
                    
                    if (mode === 'running') maxDistance = 20;
                    if (mode === 'cycling') maxDistance = 50;
                    
                    distanceSlider.max = maxDistance;
                    maxLabel.textContent = maxDistance + 'km';
                });
            });
        }
    }

    handleMapClick(event) {
        console.log('Clic sur la carte:', event.latlng);
        
        if (!this.startPoint) {
            this.setStartPoint(event.latlng);
        } else if (!this.endPoint) {
            this.setEndPoint(event.latlng);
        }
    }

    setStartPoint(latlng) {
        // Supprimer le marqueur de départ existant
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }

        // Créer le nouveau marqueur de départ
        this.startMarker = L.marker(latlng, {
            icon: L.divIcon({
                html: '<div style="background: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
                className: 'custom-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);

        this.startPoint = latlng;
        console.log('✅ Point de départ défini:', latlng);
    }

    setEndPoint(latlng) {
        // Supprimer le marqueur d'arrivée existant
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }

        // Créer le nouveau marqueur d'arrivée
        this.endMarker = L.marker(latlng, {
            icon: L.divIcon({
                html: '<div style="background: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
                className: 'custom-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);

        this.endPoint = latlng;
        console.log('✅ Point d\'arrivée défini:', latlng);
    }

    async generateRoute() {
        console.log('🛣️ Génération du parcours...');
        
        if (!this.startPoint) {
            this.showError('Veuillez définir un point de départ en cliquant sur la carte');
            return;
        }

        try {
            this.showLoading();
            
            // Obtenir les paramètres
            const distance = parseFloat(document.getElementById('targetDistance')?.value || 3);
            const mode = document.querySelector('input[name="travelMode"]:checked')?.value || 'walking';
            const returnToStart = document.getElementById('returnToStart')?.checked || true;
            
            console.log(`Paramètres: ${distance}km, mode: ${mode}, retour: ${returnToStart}`);
            
            // Générer un parcours amélioré
            const route = await this.createSmartRoute(this.startPoint, distance, mode, returnToStart);
            
            if (route && route.length > 0) {
                this.displayRoute(route, distance, mode);
                this.hideLoading();
                this.showResults(route, distance, mode);
                console.log('✅ Parcours généré avec succès');
            } else {
                throw new Error('Impossible de générer un parcours pour cette zone');
            }
            
        } catch (error) {
            this.hideLoading();
            this.showError(error.message || 'Erreur lors de la génération du parcours');
            console.error('❌ Erreur génération:', error);
        }
    }

    /**
     * Génère un parcours intelligent basé sur la distance et le mode
     */
    async createSmartRoute(startPoint, targetDistance, mode, returnToStart) {
        console.log(`Génération d'un parcours de ${targetDistance}km en mode ${mode}`);
        
        // Calculer le rayon approximatif pour la distance cible
        const radiusKm = targetDistance / (2 * Math.PI); // Pour un cercle parfait
        const radiusDeg = radiusKm / 111; // Conversion approximative km -> degrés
        
        // Ajustements selon le mode de transport
        let routeComplexity = 8; // Nombre de points de base
        let detourFactor = 1.0;
        
        switch (mode) {
            case 'running':
                routeComplexity = 12;
                detourFactor = 1.2; // Plus de détours pour la course
                break;
            case 'cycling':
                routeComplexity = 6;
                detourFactor = 0.8; // Plus direct pour le vélo
                break;
            case 'walking':
            default:
                routeComplexity = 10;
                detourFactor = 1.1;
                break;
        }
        
        const route = [];
        const center = startPoint;
        
        // Génération de points de passage avec variation
        for (let i = 0; i <= routeComplexity; i++) {
            const angle = (i / routeComplexity) * 2 * Math.PI;
            
            // Variation du rayon pour rendre le parcours moins circulaire
            const radiusVariation = 0.7 + (Math.random() * 0.6); // Entre 0.7 et 1.3
            const currentRadius = radiusDeg * radiusVariation * detourFactor;
            
            // Variation angulaire pour créer des méandres
            const angleVariation = (Math.random() - 0.5) * 0.3; // ±17 degrés
            const finalAngle = angle + angleVariation;
            
            const lat = center.lat + Math.cos(finalAngle) * currentRadius;
            const lng = center.lng + Math.sin(finalAngle) * currentRadius;
            
            route.push(L.latLng(lat, lng));
        }
        
        // Fermer le parcours si retour au départ
        if (returnToStart) {
            route.push(startPoint);
        }
        
        // Calculer la distance réelle
        const actualDistance = this.calculateRouteDistance(route);
        console.log(`Distance calculée: ${actualDistance.toFixed(2)}km (cible: ${targetDistance}km)`);
        
        return route;
    }

    /**
     * Calcule la distance totale d'un parcours
     */
    calculateRouteDistance(route) {
        if (!route || route.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < route.length; i++) {
            totalDistance += route[i-1].distanceTo(route[i]);
        }
        
        return totalDistance / 1000; // Conversion en kilomètres
    }

    /**
     * Affiche le parcours sur la carte
     */
    displayRoute(route, targetDistance, mode) {
        // Supprimer l'ancien parcours
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
        }

        // Couleur selon le mode
        let routeColor = '#8B5CF6';
        switch (mode) {
            case 'running':
                routeColor = '#EF4444'; // Rouge pour course
                break;
            case 'cycling':
                routeColor = '#10B981'; // Vert pour vélo
                break;
            case 'walking':
            default:
                routeColor = '#8B5CF6'; // Violet pour marche
                break;
        }

        // Créer la polyline
        this.routePolyline = L.polyline(route, {
            color: routeColor,
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1
        }).addTo(this.map);

        // Ajouter des marqueurs aux points clés
        const midPoint = Math.floor(route.length / 2);
        if (route[midPoint]) {
            L.circleMarker(route[midPoint], {
                radius: 6,
                fillColor: routeColor,
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(this.map).bindPopup(`Point intermédiaire`);
        }

        // Ajuster la vue
        this.map.fitBounds(this.routePolyline.getBounds(), { 
            padding: [20, 20] 
        });
    }

    createTestRoute() {
        // Méthode obsolète - remplacée par createSmartRoute
        console.warn('createTestRoute est obsolète, utiliser createSmartRoute');
    }

    showResults(route, targetDistance, mode) {
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        // Calculer les statistiques réelles
        const actualDistance = this.calculateRouteDistance(route);
        const duration = this.calculateDuration(actualDistance, mode);
        const deviation = Math.abs(actualDistance - targetDistance);

        // Mettre à jour les statistiques
        const distanceResult = document.getElementById('distanceResult');
        const durationResult = document.getElementById('durationResult');
        const deviationResult = document.getElementById('deviationResult');

        if (distanceResult) distanceResult.textContent = `${actualDistance.toFixed(1)} km`;
        if (durationResult) durationResult.textContent = this.formatDuration(duration);
        if (deviationResult) deviationResult.textContent = `${deviation.toFixed(1)} km`;

        console.log(`📊 Statistiques: ${actualDistance.toFixed(1)}km en ${this.formatDuration(duration)}`);
    }

    /**
     * Calcule la durée estimée selon le mode et la distance
     */
    calculateDuration(distance, mode) {
        // Vitesses moyennes en km/h
        const speeds = {
            walking: 5,
            running: 10,
            cycling: 20
        };

        const speed = speeds[mode] || speeds.walking;
        return (distance / speed) * 60; // Durée en minutes
    }

    /**
     * Formate la durée en format lisible
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = Math.round(minutes % 60);
            if (remainingMinutes === 0) {
                return `${hours}h`;
            } else {
                return `${hours}h${remainingMinutes}`;
            }
        }
    }

    useCurrentLocation() {
        console.log('📍 Obtention de la position...');
        
        if (!navigator.geolocation) {
            this.showError('La géolocalisation n\'est pas supportée');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
                this.setStartPoint(latlng);
                this.map.setView(latlng, 15);
                console.log('✅ Position obtenue:', latlng);
            },
            (error) => {
                this.showError('Impossible d\'obtenir votre position');
                console.error('❌ Erreur géolocalisation:', error);
            }
        );
    }

    exportGPX() {
        console.log('📁 Export GPX...');
        if (!this.routePolyline) {
            this.showError('Aucun parcours à exporter');
            return;
        }

        // Export GPX simple
        const points = this.routePolyline.getLatLngs();
        let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
        gpx += '<gpx version="1.1">\n';
        gpx += '<trk><name>Parcours RunMyWay</name><trkseg>\n';
        
        points.forEach(point => {
            gpx += `<trkpt lat="${point.lat}" lon="${point.lng}"></trkpt>\n`;
        });
        
        gpx += '</trkseg></trk>\n</gpx>';

        const blob = new Blob([gpx], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parcours-runmyway.gpx';
        a.click();
        URL.revokeObjectURL(url);

        console.log('✅ GPX exporté');
    }

    reset() {
        console.log('🔄 Remise à zéro...');
        
        // Supprimer les marqueurs
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
            this.startMarker = null;
        }
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
            this.endMarker = null;
        }
        
        // Supprimer le parcours
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
            this.routePolyline = null;
        }

        // Reset des points et POI
        this.startPoint = null;
        this.endPoint = null;
        
        // Nettoyer les POI
        this.pois.forEach(poi => this.removePOIMarker(poi));
        this.pois = [];
        this.updatePOIChips();
        
        // Désactiver tous les presets POI
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Masquer les résultats
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }

        // Reset des champs d'adresse et POI
        const startAddress = document.getElementById('startAddress');
        const endAddress = document.getElementById('endAddress');
        const poiInput = document.getElementById('poiInput');
        if (startAddress) startAddress.value = '';
        if (endAddress) endAddress.value = '';
        if (poiInput) poiInput.value = '';
        
        // Masquer les suggestions
        this.hideSuggestions(document.getElementById('startAddressSuggestions'));
        this.hideSuggestions(document.getElementById('endAddressSuggestions'));
        this.hideSuggestions(document.getElementById('poiSuggestions'));

        // Recentrer sur Paris
        this.map.setView([48.8566, 2.3522], 12);
        
        console.log('✅ Application remise à zéro');
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.style.display = 'block';
            
            setTimeout(() => {
                errorAlert.style.display = 'none';
            }, 5000);
        }
        
        console.error('Erreur:', message);
    }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    console.log('📦 DOM chargé, initialisation...');
    
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet non chargé');
        return;
    }
    
    window.runMyWayApp = new RunMyWayApp();
    window.runMyWayApp.init();
});

console.log('📦 Script RunMyWay chargé');
