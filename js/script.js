'use strict';

// let map, mapEvent;

class Workout {
	date = new Date();
	id = (Date.now() + '').slice(-10);
	clicks = 0;

	constructor(coords, distance, duration) {
		this.coords = coords; // [lat, lng]
		this.distance = distance; // In KM
		this.duration = duration; // In Minutes
	}

	_setDescribtion() {
		// prettier-ignore
		const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

		this.describtion = `${this.type.replace(
			this.type[0],
			this.type[0].toUpperCase()
		)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
	}

	click() {
		this.clicks++;
	}
}

class Running extends Workout {
	type = 'running';
	constructor(coords, distance, duration, cadence) {
		super(coords, distance, duration);
		this.cadence = cadence;
		this.calcPace();
		this._setDescribtion();
	}

	calcPace() {
		// min/km
		this.pace = this.duration / this.distance;
		return this.pace;
	}
}

class Cycling extends Workout {
	type = 'cycling';
	constructor(coords, distance, duration, elevationGain) {
		super(coords, distance, duration);
		this.elevationGain = elevationGain;
		this.calcSpeed();
		this._setDescribtion();
	}

	calcSpeed() {
		// km / h
		this.speed = this.distance / (this.duration / 60);
		return this.speed;
	}
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycle1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1.coords, cycle1.coords);

/////////////////////////////////////////////
// APPLICATIOON ARCHITECTURE

const form = document.querySelector('.form');
const formEdit = document.querySelector('.form-editing');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const clearAllBtn = document.querySelector('.clear-btn');

class App {
	#userCoords = [];
	#map;
	#mapZoomLevel = 13;
	#mapEvent;
	#workouts = [];
	#workoutMarkers = [];
	constructor() {
		// Get User's Position
		this._getPosition();

		// Get data from local storage
		this._getLocalStorage();

		// Attach even handlers
		form.addEventListener('submit', this._newWorkout.bind(this));

		inputType.addEventListener('change', this._toggleElevationField.bind(this));

		containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

		containerWorkouts.addEventListener('click', this._editWorkout.bind(this));

		containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

		clearAllBtn.addEventListener('click', this.reset.bind(this));
	}

	_getPosition() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				// because _loadMap() is being called by the callback function getCurrentPosition() so the this keyword is set to undefinded, so in the next line we are binding it to [this] which points to the object
				this._loadMap.bind(this),
				function () {
					alert('Could not get your position');
				}
			);
		}
	}

	_loadMap(position) {
		const { latitude, longitude } = position.coords;

		this.#userCoords[0] = latitude;
		this.#userCoords[1] = longitude;

		const coords = [latitude, longitude];
		this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

		L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		}).addTo(this.#map);

		// Handling Clicks On Map
		this.#map.on('click', this._showForm.bind(this));

		this.#workouts.forEach(work => {
			this._renderWorkoutMarker(work);
		});
	}

	_showForm(mapE) {
		this.#mapEvent = mapE;
		form.classList.remove('hidden');
		inputDistance.focus();
	}

	_showFormOnEdit(workout) {}

	_hideForm() {
		inputDistance.value =
			inputCadence.value =
			inputDuration.value =
			inputElevation.value =
				'';

		form.style.display = 'none';
		form.classList.add('hidden');
		setTimeout(() => (form.style.display = 'grid'), 1000);
	}

	_toggleElevationField() {
		inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
		inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
	}

	_newWorkout(e) {
		const validInputs = (...inputs) =>
			inputs.every(inp => Number.isFinite(inp));

		const allPositive = (...inputs) => inputs.every(inp => inp > 0);
		e.preventDefault();

		// Get data from the form
		const type = inputType.value;
		const duration = +inputDuration.value;
		const distance = +inputDistance.value;
		const { lat, lng } = this.#mapEvent.latlng;
		let workout;

		// If workout running, create running object
		if (type === 'running') {
			const cadence = +inputCadence.value;

			// Check if data is valid
			if (
				// !Number.isFinite(distance) ||
				// !Number.isFinite(duration) ||
				// !Number.isFinite(cadence)

				!validInputs(distance, duration, cadence) ||
				!allPositive(distance, duration, cadence)
			)
				return alert('inputs have to be positive numbers');

			workout = new Running([lat, lng], distance, duration, cadence);
		}

		// If workout cycling, create cycling object
		if (type === 'cycling') {
			const elevation = +inputElevation.value;

			if (
				!validInputs(distance, duration, elevation) ||
				!allPositive(distance, duration)
			)
				return alert('inputs have to be positive numbers');

			workout = new Cycling([lat, lng], distance, duration, elevation);
		}

		// Add new object to the workout array

		this.#workouts.push(workout);

		// Render workout on map as a marker
		this._renderWorkoutMarker(workout);

		// Render workout on the list
		this._renderWorkout(workout);

		// Hide form + Clear input fields
		this._hideForm();

		// Set local storage to all workouts

		this._setLocalStorage();
	}

	_removeWorkout(workout) {}

	_renderWorkoutMarker(workout) {
		const marker = L.marker(workout.coords)
			.addTo(this.#map)
			.bindPopup(
				L.popup({
					maxWidth: 250,
					minWidth: 100,
					autoClose: false,
					closeOnClick: false,
					className: `${workout.type}-popup`,
				})
			)
			.setPopupContent(
				`${workout.type === 'running' ? '🏃‍♂️' : '⚡️'} ${workout.describtion}`
			)
			.openPopup();
		this.#workoutMarkers.push(marker);
		return marker;
	}

	_renderWorkout(workout) {
		let html = `
            <li class="workout workout--${workout.type}" data-id="${
			workout.id
		}">
            <h2 class="workout__title">${workout.describtion}</h2>
			
            <div class="workout__details">
                <span class="workout__icon">${
									workout.type === 'running' ? '🏃‍♂️' : '⚡️'
								}</span>
                <span class="workout__value">${workout.distance}</span>
                <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">⏱</span>
                <span class="workout__value">${workout.duration}</span>
                <span class="workout__unit">min</span>
            </div>
			<ion-icon class="edit" name="pencil-outline"></ion-icon>
			<ion-icon class="delete" name="trash-outline"></ion-icon>
        `;

		if (workout.type === 'running') {
			html += `
                <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${workout.pace.toFixed(1)}</span>
                <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">🦶🏼</span>
                <span class="workout__value">${workout.cadence}</span>
                <span class="workout__unit">spm</span>
            </div>
            </li>
            `;
		}

		if (workout.type === 'cycling') {
			html += `
                <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${workout.speed.toFixed(1)}</span>
                <span class="workout__unit">km/h</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">⛰</span>
                <span class="workout__value">${workout.elevationGain}</span>
                <span class="workout__unit">m</span>
            </div>
            </li>
            `;
		}

		form.insertAdjacentHTML('afterend', html);
	}

	_moveToPopup(e) {
		if (!this.#map) return;

		const workoutEl = e.target.closest('.workout');

		if (!workoutEl) return;

		const workout = this.#workouts.find(
			work => work.id === workoutEl.dataset.id
		);

		this.#map.setView(workout.coords, this.#mapZoomLevel, {
			animate: true,
			pan: {
				duration: 1,
			},
		});

		// using the public interface
		// workout.click();
	}

	_setLocalStorage() {
		localStorage.setItem('workouts', JSON.stringify(this.#workouts));
	}

	_getLocalStorage() {
		const data = JSON.parse(localStorage.getItem('workouts'));

		if (!data) return;

		this.#workouts = data;

		this.#workouts.forEach(work => {
			this._renderWorkout(work);
		});
	}

	reset() {
		localStorage.removeItem('workouts');
		location.reload();
	}

	_editWorkout(e) {
		const type = document.querySelector('.form__input--type-edit');
		const distance = document.querySelector('.form__input--distance-edit');
		const duration = document.querySelector('.form__input--duration-edit');
		const cadence = document.querySelector('.form__input--cadence-edit');
		const elevation = document.querySelector('.form__input--elevation-edit');

		const editEls = document.querySelectorAll('.edit');
		editEls.forEach(el => {
			if (e.target === el) {
				e.preventDefault();
				const workEl = el.closest('.workout');
				const workout = this.#workouts.find(
					work => work.id === workEl.dataset.id
				);

				type.value = workout.type;
				distance.value = workout.distance;
				duration.value = workout.duration;

				if (workout.type === 'running') {
					cadence.closest('.form__row').classList.remove('form__row--hidden');
					elevation.closest('.form__row').classList.add('form__row--hidden');
					cadence.value = workout.cadence;
				}

				if (workout.type === 'cycling') {
					cadence.closest('.form__row').classList.add('form__row--hidden');
					elevation.closest('.form__row').classList.remove('form__row--hidden');
					elevation.value = workout.elevationGain;
				}

				let self = this;
				formEdit.addEventListener('submit', function (e) {
					e.preventDefault();
					workout.distance = +distance.value;
					workout.duration = +duration.value;

					if (workout.type === 'running') {
						workout.cadence = +cadence.value;
					}
					if (workout.type === 'cycling') {
						workout.elevationGain = +elevation.value;
					}

					formEdit.classList.add('hidden');

					// Updating local storage
					// this._removeWorkout(workout);
					self._setLocalStorage();
					workEl.remove();
					self._renderWorkout(workout);
				});

				formEdit.classList.remove('hidden');
			}
		});
	}

	_deleteWorkout(e) {
		if (e.target.closest('.delete')) {
			const el = e.target.closest('.workout');
			const workoutCoords = this.#workouts.find(
				workout => workout.id === el.dataset.id
			).coords;

			const markerIndex = this.#workoutMarkers.findIndex(marker => {
				return (
					marker._latlng.lat === workoutCoords[0] &&
					marker._latlng.lng === workoutCoords[1]
				);
			});

			this.#map.removeLayer(this.#workoutMarkers[markerIndex]); // Delete from UI
			this.#workoutMarkers.splice(markerIndex, 1); // Delete from workouMarkers Array
			const workEl = el.closest('.workout');
			const workoutIndx = this.#workouts.findIndex(
				work => work.id === workEl.dataset.id
			);

			workEl.remove();
			this.#workouts.splice(workoutIndx, 1);
			// this.#map.removeLayer(marker(this.#workouts[workoutIndx].coords));

			if (this.#workouts.length !== 0) {
				this._setLocalStorage(); // Will overwrite the previous 'workout' item
			} else {
				localStorage.removeItem('workouts');

				// Also, if we delete the last workout, the map should be positioned on user's initial coords
				this.#map.setView(this.#userCoords, this.#mapZoomLevel, {
					animate: true,
					duration: 1,
				});
			}
		}
	}
}
const app = new App();
