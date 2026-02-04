<?php
// Bootstrap REDCap External Module system
$module = ExternalModules\ExternalModules::getModuleInstance('PublicationValidator');

// Make sure the request is valid and comes from REDCap
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method not allowed
    echo json_encode(['status' => 'error', 'msg' => 'Invalid request method']);
    exit;
}

// Grab posted data (sanitize as needed)
$record   = $_POST['record'] ?? null;
$instrument = $_POST['instrument'] ?? null;

// Do something useful with REDCap
if ($record) {
    // Example: fetch some field values from this record
    $data = \REDCap::getData([
        'project_id' => $module->getProjectId(),
        'records'    => [$record],
        'fields'     => ['record_id', 'first_name', 'last_name'] // change as needed
    ]);

    // Flatten result
    $row = array_shift($data[$record] ?? []);

    echo json_encode([
        'status'     => 'success',
        'record'     => $record,
        'instrument' => $instrument,
        'values'     => $row,
        'timestamp'  => date('Y-m-d H:i:s')
    ]);
} else {
    echo json_encode(['status' => 'error', 'msg' => 'No record provided']);
}
