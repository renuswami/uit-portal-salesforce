import { LightningElement, wire, track } from 'lwc';
import getProjectHierarchy from '@salesforce/apex/ProjectHierarchyController.getProjectHierarchy';

export default class ProjectHierarchy extends LightningElement {
    @track hierarchyData = [];
    @track isLoading = true;

    @wire(getProjectHierarchy)
    wiredHierarchy({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.hierarchyData = this.processData(JSON.parse(JSON.stringify(data)));
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching hierarchy:', error);
            this.isLoading = false;
        }
    }

    processData(projects) {
        return projects.map(project => {
            const hasTasks = project.projectTasks && project.projectTasks.length > 0;
            return {
                ...project,
                isExpanded: false,
                iconName: 'utility:chevronright',
                hasTasks: hasTasks,
                projectTasks: hasTasks ? project.projectTasks.map(task => {
                    const hasSubTasks = task.subTasks && task.subTasks.length > 0;
                    return {
                        ...task,
                        isExpanded: false,
                        showDetails: false,
                        // If no subtasks, show record icon (leaf node), otherwise chevron (expandable)
                        iconName: hasSubTasks ? 'utility:chevronright' : 'utility:record',
                        hasNoSubTasks: !hasSubTasks,
                        badgeClass: this.getBadgeClass(task.status),
                        initials: this.getInitials(task.assignedToName),
                        subTasks: hasSubTasks ? task.subTasks.map(subTask => ({
                            ...subTask,
                            showDetails: false,
                            badgeClass: this.getBadgeClass(subTask.status),
                            initials: this.getInitials(subTask.assignedToName)
                        })) : []
                    };
                }) : []
            };
        });
    }

    getBadgeClass(status) {
        if (!status) return 'slds-badge slds-badge_lightest';
        const s = status.toLowerCase();
        if (s.includes('completed') || s.includes('closed') || s.includes('done')) {
            return 'slds-badge slds-theme_success';
        }
        if (s.includes('progress') || s.includes('working')) {
            return 'slds-badge slds-theme_warning';
        }
        if (s.includes('blocked') || s.includes('hold')) {
            return 'slds-badge slds-theme_error';
        }
        return 'slds-badge slds-badge_lightest';
    }

    getInitials(name) {
        if (!name) return 'UA'; // Unassigned
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    toggleProject(event) {
        const projectId = event.currentTarget.dataset.id;
        const projectIndex = this.hierarchyData.findIndex(p => p.id === projectId);
        if (projectIndex !== -1) {
            const project = this.hierarchyData[projectIndex];
            project.isExpanded = !project.isExpanded;
            project.iconName = project.isExpanded ? 'utility:chevrondown' : 'utility:chevronright';
        }
    }

    toggleTask(event) {
        event.stopPropagation(); // Prevent bubbling to project toggle
        const taskId = event.currentTarget.dataset.id;
        const projectId = event.currentTarget.dataset.projectId;
        
        const project = this.hierarchyData.find(p => p.id === projectId);
        if (project) {
            const task = project.projectTasks.find(t => t.id === taskId);
            if (task) {
                if (task.hasNoSubTasks) {
                    // If no sub-tasks, toggle details inline
                    task.showDetails = !task.showDetails;
                } else {
                    // If has sub-tasks, toggle expansion
                    task.isExpanded = !task.isExpanded;
                    task.iconName = task.isExpanded ? 'utility:chevrondown' : 'utility:chevronright';
                }
            }
        }
    }

    handleSubTaskClick(event) {
        event.stopPropagation();
        const subTaskId = event.currentTarget.dataset.id;
        const taskId = event.currentTarget.dataset.taskId;
        const projectId = event.currentTarget.dataset.projectId;

        // Find the subtask object
        const project = this.hierarchyData.find(p => p.id === projectId);
        if (project) {
            const task = project.projectTasks.find(t => t.id === taskId);
            if (task) {
                const subTask = task.subTasks.find(st => st.id === subTaskId);
                if (subTask) {
                    subTask.showDetails = !subTask.showDetails;
                }
            }
        }
    }
}