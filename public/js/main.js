// DOM Elements
const authButtons = document.querySelector('.auth-buttons');
const userMenu = document.querySelector('.user-menu');
const userName = document.querySelector('.user-name');
const logoutBtn = document.getElementById('logoutBtn');
const authOnlyElements = document.querySelectorAll('.auth-only');
const doctorOnlyElements = document.querySelectorAll('.doctor-only');

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.authenticated) {
            showAuthenticatedUI(data.user);
        } else {
            showUnauthenticatedUI();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showUnauthenticatedUI();
    }
}

// Show UI for authenticated users
function showAuthenticatedUI(user) {
    authButtons.style.display = 'none';
    userMenu.style.display = 'block';
    userName.textContent = user.full_name;
    
    // Show/hide elements based on user role
    authOnlyElements.forEach(el => el.style.display = 'block');
    if (user.role === 'doctor') {
        doctorOnlyElements.forEach(el => el.style.display = 'block');
    }
}

// Show UI for unauthenticated users
function showUnauthenticatedUI() {
    authButtons.style.display = 'block';
    userMenu.style.display = 'none';
    authOnlyElements.forEach(el => el.style.display = 'none');
    doctorOnlyElements.forEach(el => el.style.display = 'none');
}

// Handle logout
async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});

// Form validation
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return true;

    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
    });

    return isValid;
}

// Show loading spinner
function showSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    document.body.appendChild(spinner);
}

// Hide loading spinner
function hideSpinner() {
    const spinner = document.querySelector('.spinner');
    if (spinner) {
        spinner.remove();
    }
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Handle API errors
function handleApiError(error) {
    console.error('API Error:', error);
    showAlert(error.message || 'An error occurred. Please try again.', 'danger');
}

// Export functions for use in other modules
window.appUtils = {
    validateForm,
    showSpinner,
    hideSpinner,
    showAlert,
    formatDate,
    handleApiError
}; 