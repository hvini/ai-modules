document.addEventListener('DOMContentLoaded', () => {
    const tasksContainer = document.getElementById('tasks-container');

    const tasks = [
        { description: 'Adjust slope and intercept to achieve a strong linear fit', achievementKey: 'Line Whisperer' },
        { description: 'Analyze how outliers affect model accuracy and fit', achievementKey: 'Outlier Avalanche' },
        { description: 'Identify and remove outliers to improve model performance', achievementKey: 'Outlier Exterminator' },
        { description: 'Fine-tune the regression line for the best possible fit', achievementKey: 'Line Tamer' },
        { description: 'Investigate how tolerance settings impact line fitting', achievementKey: 'Tame the Beast' },
        { description: 'Interact with and analyze all available datasets', achievementKey: 'Exploration Enthusiast' },
        { description: 'Apply quadratic terms to model nonlinear patterns effectively', achievementKey: 'Curve Master' },
    ];

    function renderTasks() {
        tasksContainer.innerHTML = '';

        const achievements = localStorage.getItem("achievements") || [];

        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.classList.add('task');

            const descriptionElement = document.createElement('div');
            descriptionElement.classList.add('task-description');
            descriptionElement.textContent = task.description;

            const statusElement = document.createElement('div');
            statusElement.classList.add('task-status');

            taskElement.appendChild(descriptionElement);
            taskElement.appendChild(statusElement);

            if (achievements.includes(task.achievementKey)) {
                taskElement.classList.add('completed');
            }

            tasksContainer.appendChild(taskElement);
        });
    }

    renderTasks();
});