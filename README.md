# FlightTracker-Publication-Validator

1. Rename the folder to include a version number (for example: _v1.0.0) if it does not already have a version or it will not be recognized by REDCap.

# Configuration
This external module expects that you have created a form which you wish to store a user's validation responses in. It requires some specific formatting to work. The survey should have paragraph fields with ID's containing "supported_pubs_<year>". This is used so that the program knows what fields need to be restyled, and also which flight tracker entries should be displayed. An instrument zip of the form used in my development is available in this repo.

In the settings for the module there are the following requried fields:

1. Validation Form: this tells the app which survey will be reformatted for the end-user. If you don't know the form's name you can check this by going into the `Record Status Dashboard` and selecting one of the records. The page parameter in the URL is the name for the form.

2. When creating forms to use this module with, you need to ensure that questions which should be reformatted to look like multiple choice questions have an ID that contains "supported_pubs_" as
string matching is used to hide the textareas which will contain the choices made by each user.

# How Does It Work?
The PublicationValidator assumes certain formats for forms. A sample format will be included with this repository. It then uses the `redcap_survey_page()` hook to reformat the survey before a user has the chance to complete it.

# Reasoning Behind Survey Formatting
The hidden fields are used to convey data in a way that is easier to access and process when rewriting aspects of the page and collecting necessary data for display.

The hidden linkblue field is there for matching users to their data as all the data from the flighttracker databases need to be pulled and then matched. I am working out if I can just get 1 user's data to make it more lean.

The hidden years are there for me to have an easy way to collect which years I'm working with to filter only publications which occurred after that point and ones which have not yet been chosen.

The fields to hold data are formatted as paragraph boxes rather than multiple choice. This is due to the nature of how multiple choice is treated in redcap. Javascript is used to give the appearance of multiple choice input, but it is then loaded as an array of the citations selected into the paragraph box for easy usage later.

# Known Issues
During testing, I've encountered issues where no publications load. In this instance all I needed to do was refresh the API key for the affected dataset.

# Contact
If you encounter issues or have feature requests, you can reach out to me by [email](mailto:ncpe227@uky.edu) or open a pull request on the project's [github page](https://github.com/innovationcore/FlightTracker-Publication-Validator/pulls).
