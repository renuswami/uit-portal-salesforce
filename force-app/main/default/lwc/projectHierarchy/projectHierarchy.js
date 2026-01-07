import { LightningElement, wire, track } from 'lwc';
import getProjectHierarchy from '@salesforce/apex/ProjectHierarchyController.getProjectHierarchy';

export default class ProjectHierarchy extends LightningElement {
    @track hierarchyData = [];
    @track flattenedData = []; // Flat list for the tree grid
    @track selectedTask = null; // Currently selected task for right panel
    @track selectedRowId = null; // Track selected row ID for highlighting
    @track isLoading = true;

    @wire(getProjectHierarchy)
    wiredHierarchy({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.hierarchyData = JSON.parse(JSON.stringify(data));
            this.flattenData();
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching hierarchy:', error);
            this.isLoading = false;
        }
    }

    // Flatten hierarchy into a linear list for easier rendering in a "table-tree"
    flattenData() {
        let rows = [];
        this.hierarchyData.forEach(project => {
            // Add Project Row
            rows.push({
                id: project.id,
    name: project.name,
    type: 'project',
    isProject: true,
    level: 0,
                isExpanded: project.isExpanded || false, // Default state
                hasChildren: project.projectTasks && project.projectTasks.length > 0,
                iconName: (project.isExpanded) ? 'utility:chevrondown' : 'utility:chevronright',
                status: project.status,
                startDate: project.startDate,
                endDate: project.endDate,
                isVisible: true,
                badgeClass: this.getStatusClass(project.status),
                rowClass: this.getRowClass(project.id),
                indentClass: `indent-0`
            });

            // If Project is Expanded, add Tasks
            if (project.isExpanded && project.projectTasks) {
                project.projectTasks.forEach(task => {
                    rows.push({
                        id: task.id,
                        name: task.name,
                        type: 'task',
                        level: 1,
                            isProject: false,

                        isExpanded: task.isExpanded || false,
                        hasChildren: task.subTasks && task.subTasks.length > 0,
                        iconName: (task.isExpanded) ? 'utility:chevrondown' : 'utility:chevronright',
                        status: task.status,
                        assignedToName: task.assignedToName,
                        initials: this.getInitials(task.assignedToName),
                        dueDate: task.dueDate,
                        estimatedHours: task.estimatedHours,
                        actualHours: task.actualHours,
                        isVisible: true,
                        // New Fields Mapping
                        parentTaskName: task.parentTaskName,
                        relatedProject: task.relatedProject,
                        approvedLoggedHours: task.approvedLoggedHours,
                        actualNonBillableHours: task.actualNonBillableHours,
                        totalSubTaskHours: task.totalSubTaskHours,
                        totalSubTaskNonBillableHours: task.totalSubTaskNonBillableHours,
                        // Raw Data for Detail Panel
                        ...task,
                        badgeClass: this.getStatusClass(task.status),
                        rowClass: this.getRowClass(task.id),
                        indentClass: `indent-1`
                    });

                    // If Task is Expanded, add Subtasks
                    if (task.isExpanded && task.subTasks) {
                        task.subTasks.forEach(sub => {
                            rows.push({
                                id: sub.id,
                                name: sub.name,
                                type: 'subtask',
                                level: 2,
                                    isProject: false,

                                isExpanded: false,
                                hasChildren: false,
                                iconName: 'utility:record', // Leaf node
                                status: sub.status,
                                assignedToName: sub.assignedToName,
                                initials: this.getInitials(sub.assignedToName),
                                dueDate: sub.dueDate,
                                estimatedHours: sub.estimatedHours,
                                actualHours: sub.actualHours,
                                isVisible: true,
                                // New Fields Mapping for Subtask
                                parentTaskName: sub.parentTaskName,
                                relatedProject: sub.relatedProject,
                                approvedLoggedHours: sub.approvedLoggedHours,
                                actualNonBillableHours: sub.actualNonBillableHours,
                                totalSubTaskHours: sub.totalSubTaskHours,
                                totalSubTaskNonBillableHours: sub.totalSubTaskNonBillableHours,
                                // Raw Data
                                ...sub,
                                badgeClass: this.getStatusClass(sub.status),
                                rowClass: this.getRowClass(sub.id),
                                indentClass: `indent-2`
                            });
                        });
                    }
                });
            }
        });
        this.flattenedData = rows;
    }
handleRowClick(event) {
    const id = event.currentTarget.dataset.id;
    const type = event.currentTarget.dataset.type;

    this.selectedRowId = id;
    const row = this.flattenedData.find(r => r.id === id);

    if (!row) return;

    const isLeaf = (row.type === 'subtask') || (row.type === 'task' && !row.hasChildren);

    if (isLeaf) {
        this.selectedTask = row;
    } else {
        this.selectedTask = null;
        this.toggleRow(id);
    }

    this.flattenedData = this.flattenedData.map(r => ({ ...r }));
}


    // Helper to reuse toggle logic
    toggleRow(id) {
        // Find in original hierarchy structure to toggle state
        // 1. Check Projects
        let project = this.hierarchyData.find(p => p.id === id);
        if (project) {
            project.isExpanded = !project.isExpanded;
        } else {
            // 2. Check Tasks (Level 2)
            for (let p of this.hierarchyData) {
                if (p.projectTasks) {
                    let task = p.projectTasks.find(t => t.id === id);
                    if (task) {
                        task.isExpanded = !task.isExpanded;
                        break;
                    }
                }
            }
        }
        // Re-calculate flat list
        this.flattenData();
    }

   handleToggle(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    this.toggleRow(id);
}


    get isProjectTask() {
        return this.selectedTask && this.selectedTask.type === 'task';
    }

    closeDetailPanel() {
        this.selectedTask = null;
        this.selectedRowId = null;
        this.flattenData();
    }

    getRowClass(id) {
        return (this.selectedRowId === id) ? 'tree-row selected' : 'tree-row';
    }

    getStatusClass(status) {
        if (!status) return 'status-pill status-not-started';
        const s = status.toLowerCase();
        if (s.includes('completed') || s.includes('closed') || s.includes('done') || s.includes('won')) return 'status-pill status-completed';
        if (s.includes('progress') || s.includes('working') || s.includes('active')) return 'status-pill status-in-progress';
        if (s.includes('overdue') || s.includes('blocked')) return 'status-pill status-overdue';
        return 'status-pill status-not-started';
    }

    getInitials(name) {
        if (!name) return 'UA';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
}