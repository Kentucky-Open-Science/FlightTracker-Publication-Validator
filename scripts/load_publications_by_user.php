<?php
namespace UKModules\PublicationValidator;

/** @var \ExternalModules\AbstractExternalModule $module */

use REDCap;

class CitationUtility {
    public static function getCitationsByUser($userid, $api_keys) {
        $grouped_by_year = [];

        // Note: If data is internal, use REDCap::getData().
        // If external, use this curl logic:
        foreach ($api_keys as $token) {
            $data = [
                'token' => $token,
                'content' => 'record',
                'format' => 'json',
                'type' => 'eav', // Matches your original script
                'fields' => ['citation_pmid', 'citation_full_citation', 'citation_date', 'identifier_userid'],
                'filterLogic' => "[identifier_userid] = '$userid'"
            ];

            $ch = curl_init(APP_PATH_WEBROOT_FULL . 'api/');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
            $response = curl_exec($ch);
            curl_close($ch);

            $records = json_decode($response, true);

            // Reconstruct/Flatten EAV in PHP
            $flattened = self::flattenREDCapData($records);

            foreach ($flattened as $row) {
                if (!empty($row['citation_date'])) {
                    $year = date('Y', strtotime($row['citation_date']));
                    $pmid = $row['citation_pmid'];

                    if (!isset($grouped_by_year[$year])) {
                        $grouped_by_year[$year] = [];
                    }
                    // Prevent duplicates
                    $grouped_by_year[$year][$pmid] = $row;
                }
            }
        }
        ksort($grouped_by_year);
        return $grouped_by_year;
    }

    private static function flattenREDCapData($eav_data) {
        $flat = [];
        foreach ($eav_data as $row) {
            $inst = $row['redcap_repeat_instance'] ?? 1;
            $flat[$inst]['record'] = $row['record'];
            $flat[$inst][$row['field_name']] = $row['value'];
        }
        return $flat;
    }
}