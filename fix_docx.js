const AdmZip = require('adm-zip');

function fixDocx() {
    try {
        const zip = new AdmZip('c:/Users/saisr/OneDrive/Desktop/fp/FILLED_PROJECT_TEMPLATE.docx');
        const zipEntries = zip.getEntries();
        
        let documentEntry = null;
        for (let i = 0; i < zipEntries.length; i++) {
            const entryName = zipEntries[i].entryName.toLowerCase().replace(/\\/g, '/');
            console.log("Entry:", entryName);
            if (entryName === 'word/document.xml') {
                documentEntry = zipEntries[i];
                break;
            }
        }

        if (!documentEntry) {
            console.error("word/document.xml not found in the DOCX.");
            return;
        }

        let xml = zip.readAsText(documentEntry, "utf8");
        const projectName = "Secure Online Banking Authentication";

        xml = xml.replace(/A{5,}/g, projectName);
        xml = xml.replace(/(NEXUS SECURE BANKING SYSTEM\s*)+/gi, projectName + ' ');
        xml = xml.replace(/(Secure Online Banking Authentication\s*)+/gi, projectName + ' ');

        zip.updateFile(documentEntry, Buffer.from(xml, "utf8"));
        zip.writeZip('c:/Users/saisr/OneDrive/Desktop/fp/SecureOnlineBanking_Report.docx');
        console.log("Successfully generated FINAL_PROJECT_REPORT.docx");
    } catch (e) {
        console.error("Error updating DOCX:", e);
    }
}

fixDocx();
