

new Vue({
    el: '#app',
    data: {
        level0: [],
        search: "",
        importErrors:"",
        subgroupDisplay: null,
        teamDisplay: null,
        highlightPerson: null,
        busline_id: 0,
        groupTypes: groupTypes,
        searchList: [],
        updatedOn: '',
        headerTitle: '??',
        emptySubgroup: {
            editable: false,
            name: null,
            description: null,
            type: null,
            group: null,
            newGroupId: null,
            edit: true,
            lead: { name: null, id: null, url:"" },
            supportRoles: [],
            teams: []
        },
        emptyTeam: { name: 'tt', edit: true, lead: { name: "", id: "", url:"" }, members: [] }
    },
    created: function () {
        var that = this;
        this.editable = editable;
        this.level0 = retaildata.data;
        this.updatedOn = retaildata.savedate;
        this.headerTitle = headerTitle;
        this.rebuildLevel0();
        that.fillSearchList();
    },
    computed: {
        searchresults: function () {
            if (this.search.length === 0) return [];
            var that = this;
            var result = this.searchList.filter(function (e) { console.log(e, that.search); return e.name.toLowerCase().indexOf(that.search.toLowerCase()) !== -1 })
            return result;
        }
    },
    watch: {
        search: function (val) {
            if (val === '_edit') {
                this.editable = !this.editable;
                this.search = "";
                window.onbeforeunload = null;
                window.onbeforeunload = function () {
                    return 'Did you save the data?';
                };
            }
        }
    },
    methods: {
        saveAll: function () {
            var saveData;
            var today = new Date().toJSON();
            var savedate = today.substr(8, 2) + '-' + today.substr(5, 2) + '-' + today.substr(0, 4);

            this.level0.forEach(function (l0) {
                l0.level1.forEach(function (level1) {
                    level1.group = null;  //remove circular reference for JSON.stringify
                })
            })
            saveData = "var retaildata=" + JSON.stringify({ savedate: savedate, meta: 'retail_landscape', settings: retaildata.settings, data: this.level0, }) + ";";
            this.rebuildLevel0();
            var fileName = 'Retail.js';
            var fileToSave = new Blob([saveData], {
                type: 'application/json',
                name: fileName
            });
            saveAs(fileToSave, fileName);
        },
        loadAll: function (event) {
            var x = event.target.files[0];
            var reader = new FileReader();
            var that = this;
            reader.onload = function () {
                try {
                    if (reader.result.substr(0, 15) === "var retaildata=") {
                        var text = JSON.parse(reader.result.substr(15, reader.result.length - 16))
                        that.level0 = text.data;
                        that.updatedOn = text.savedate;
                        that.rebuildLevel0();
                        that.fillSearchList();
                    }
                    else {
                        alert("Wrong input file");
                    }
                } catch (e) {
                    alert("Something went wrong, see console log");
                    console.log(e);
                }
            };
            reader.readAsText(x);
            this.$refs.loadfile.type='text';
            this.$refs.loadfile.type='file';
        },
        importData: function (infile) {
            var f = infile.target.files[0];
            var reader = new FileReader();
            var name = f.name;
            var that = this;
            reader.onload = function (e) {
                var data = e.target.result;
                var workbook = XLSX.read(data, { type: 'binary' });
                var inData = {
                    level0: XLSX.utils.sheet_to_json(workbook.Sheets['level0'], {"defval":""}),
                    level1: XLSX.utils.sheet_to_json(workbook.Sheets['level1'], {"defval":""}),
                    teams: XLSX.utils.sheet_to_json(workbook.Sheets['teams'], {"defval":""}),
                    members: XLSX.utils.sheet_to_json(workbook.Sheets['members'], {"defval":""}),
                }
                // translate each sheet to internal format, also set found to false, to report later on the problems
                inData.level0.forEach(function (d, i) {
                    inData.level0[i] = that.translateL0(d, false);
                    inData.level0[i].found = false;
                })
                inData.level1.forEach(function (d, i) {
                    inData.level1[i] = that.translateL1(d, false);
                    inData.level1[i].found = false;
                })
                inData.teams.forEach(function (d, i) {
                    inData.teams[i] = that.translateTeams(d, false);
                    inData.teams[i].found = false;
                })
                inData.members.forEach(function (d, i) {
                    inData.members[i] = that.translateMembers(d, false);
                    inData.members[i].found = false;
                })
                that.processImportData(inData);
                that.reportProblems(inData);
                that.fillSearchList();
                
            };
            reader.readAsBinaryString(f);
            this.$refs.importfile.type='text';
            this.$refs.importfile.type='file';
        },
        processImportData: function (importData) {
            this.level0 = [];
            var that = this;
            importData.level0.forEach(function (l0, i) {
                that.level0.push(that.calcLevel0(l0, importData));
            });
            this.rebuildLevel0();
        },
        calcLevel0: function (l0, importData) {
            l0.level1 = this.calcLevel1(l0, importData);
            l0.found = true;
            return (l0);
        },
        calcLevel1: function (l0, importData) {
            var level1 = this.addChildren(l0, importData.level1);
            var that = this;
            level1.forEach(function (l1) {
                l1.teams = that.calcTeams(l1, importData);
            })
            return level1;
        },
        calcTeams: function (l1, importData) {
            var teams = this.addChildren(l1, importData.teams);
            var that = this;
            teams.forEach(function (team) {
                team.members = that.calcMembers(team, importData);
            })
            return teams;
        },
        calcMembers: function (team, importData) {
            var members = this.addChildren(team, importData.members);
            return members;
        },
        addChildren: function(parent, data) {
            var children = data.filter(function (e) {
                if (e.parent_name === parent.name) {
                    e.found = true;
       
                }
                return e.parent_name === parent.name
            })
            return children;
        },
        reportProblems: function(importData) {
            var errors="";
            errors +=this.findProblem(importData.level1, 'Level1 without Level0', 'level0_name', 'level1_name');
            errors +=this.findProblem(importData.teams, 'Teams without level1', 'level1_name', 'team_name');
            errors +=this.findProblem(importData.members, 'Members without team', 'team_name', 'member_name');
            if (errors.length) {
                errors="<h1>Import problems: mismatches between sheets</h1>"+ errors;
            } else {
                alert("File is imported sucessfully");
            }
            this.importErrors=errors;

        },
        findProblem:function(tabcontent, tabname, parent_name, this_name) {
  
            var error="";
            var tab = tabcontent.filter(function (e) {
                return !e.found;
            });
            tab.forEach(function (e, i) {
                if (i === 0) {
                    error += "<h2>" + tabname + "</h2><table><th>" + parent_name+"</th><th>" + this_name+"</th>";
                }
                error += "<tr><td>" + e.parent_name + '</td><td>' + e.name + '</td></tr>';
                if (i === tab.length - 1) {
                    error += '</table>';
                }
            })
            return error;
        },
        exportData: function () {
            var wb = XLSX.utils.book_new();
            var xpdata = this.createExportData();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xpdata.level0), 'level0');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xpdata.level1), 'level1');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xpdata.teams), 'teams');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xpdata.members), 'members');
            XLSX.writeFile(wb, 'Retail.xlsx');
        },
        // these function translate between excel names and internal names.
        translateL0: function (l0, toExport) {
            if (toExport) {
                return { level0_name: l0.name };
            } else {
                return { name: l0.level0_name, edit:false };
            }
        },
        translateL1: function (l1, toExport) {
            if (toExport) {
                return { level0_name: l1.parent_name, level1_name: l1.name, level1_description: l1.description, level1_type: l1.type.name, level1_lead_id: l1.lead.id, level1_lead_name: l1.lead.name, level1_lead_url:l1.lead.url };
            } else {
                var type = groupTypes.find(function (e) {
                    return e.name === l1.level1_type
                })
                return { parent_name: l1.level0_name, name: l1.level1_name, description: l1.level1_description, type: type, lead: { id: l1.level1_lead_id, name: l1.level1_lead_name, url:l1.level1_lead_url, edit:false } };
            }
        },
        translateTeams: function (team, toExport) {
            if (toExport) {
                return { level1_name: team.parent_name, team_name: team.name, team_lead_id: team.lead.id, team_lead_name: team.lead.name, team_lead_url:team.lead.url }
            } else {
                return { parent_name: team.level1_name, name: team.team_name, lead: { id: team.team_lead_id, name: team.team_lead_name, url:team.team_lead_url, edit:false } }
            }
        },
        translateMembers: function (member, toExport) {
            if (toExport) {
                return { team_name: member.parent_name, member_name: member.name, member_id: member.id, member_url: member.url, member_role: member.role }
            } else {
                return { parent_name: member.team_name, name: member.member_name, id: member.member_id, url: member.member_url, role: member.member_role, edit:false }
            }
        },

        createExportData: function () {
            var members = [];
            var level1 = [];
            var teams = [];
            var level0 = [];
            var that = this;
            this.level0.forEach(function (level0Item) {
                level0.push(that.translateL0(level0Item, true));
                level0Item.level1.forEach(function (level1Item) {
                    level1Item.parent_name = level0Item.name;
                    level1.push(that.translateL1(level1Item, true));
                    level1Item.teams.forEach(function (teamItem) {
                        teamItem.parent_name = level1Item.name;
                        teams.push(that.translateTeams(teamItem, true));
                        teamItem.members.forEach(function (member) {
                            member.parent_name = teamItem.name;
                            members.push(that.translateMembers(member, true));
                        })
                    })
                })
            })
            return { level0: level0, level1: level1, teams: teams, members: members }
        },

        rebuildLevel0: function () {
            this.level0.forEach(function (l0, index) {
                l0.level1.forEach(function (level1) {
                    level1.group = l0;
                })
            })
        },
        fillSearchList: function () {
            var that = this;
            this.searchList=[];
   
            this.level0.forEach(function (level0Item) {
                level0Item.level1.forEach(function (level1Item) {
                    if (level1Item.lead.name)
                        that.searchList.push({ name: level1Item.lead.name, info: level1Item.name, subgroup: level1Item, team: null })
                    that.searchList.push({ name: level1Item.name, info: 'Grid', subgroup: level1Item, team: null })
                    level1Item.newGroupId = level0Item.name;
                    level1Item.teams.forEach(function (teamItem) {
                        if (teamItem.lead.name)
                            that.searchList.push({ name: teamItem.lead.name, info: teamItem.name, subgroup: level1Item, team: teamItem })
                        that.searchList.push({ name: teamItem.name, info: 'Team', subgroup: level1Item, team: teamItem })
                        teamItem.members.forEach(function (member) {
                            if (member.name)
                                that.searchList.push({ name: member.name, info: teamItem.name, subgroup: level1Item, team: teamItem })
                        })
                    })
                })
            })
        },
        clearAll: function () {
            if (confirm("Do you want to delete everything?")) {
                this.level0 = [];
            }
        },
        gotoItem: function (item) {
            this.subgroupDisplay = item.subgroup;
            this.teamDisplay = item.team;
            this.search = "";
            this.highlightPerson = item.name;
        },
        addLevel0: function () {
            this.level0.push({
                title: '', edit: true, level1: []
            })
        },
        deleteLevel0: function (index) {
            if (confirm("Do you want to delete this Business Line")) {
                this.level0.splice(index, 1);
            }
        },
        addLevel1: function (group) {
            var newsubgroup = JSON.parse(JSON.stringify(this.emptySubgroup));
            newsubgroup.group = group;
            newsubgroup.newGroupId = group.id;
            newsubgroup.type = groupTypes[0],
                group.level1.push(newsubgroup);
            this.subgroupDisplay = newsubgroup;
        },
        deleteLevel1: function (group, index) {
            if (confirm("Do you want to delete this Department")) {
                group.level1.splice(index, 1);
            }
        },
        showSubGroup: function (maingroup, subgroup) {
            this.subgroupDisplay = subgroup;
            if (maingroup.edit) this.subgroupDisplay.edit = true;
        },
        moveSubGroup: function (subgroup) {
            // find current group (level0) and remove subgroup from it;
            var l0 = this.level0.find(function (e) {
                return e.name === subgroup.group.name;
            })
            l0.level1 = l0.level1.filter(function (e) {
                return subgroup.name !== e.name;
            });
            // add subgroup to new group
            var l0_new = this.level0.find(function (e) {
                return e.name === subgroup.newGroupId;
            })
            subgroup.group = l0_new;
            l0_new.level1.push(subgroup);
        },
        showTeam: function (subgroup, team) {
            this.teamDisplay = team;
            this.teamDisplay.edit = false;
            if (subgroup.edit) this.teamDisplay.edit = true;
        },
        addTeam: function (subgroup) {
            var newblock = JSON.parse(JSON.stringify(this.emptyTeam));
            this.teamDisplay = newblock;
            this.teamDisplay.edit = true;
            subgroup.teams.push(newblock);
        },
        deleteTeam: function (group, index) {
            if (confirm("Do you want to delete this Department")) {
                group.teams.splice(index, 1);
            }
        },
        addMember: function (team) {
            team.members.push({ name: 'test', role: "testrole", id: '12345678', url:'', edit: true })
        },
        deleteMember: function (team, index) {
            team.members.splice(index, 1)
        }

    }
})
